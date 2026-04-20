<?php
declare(strict_types=1);

// Cargar variables de entorno desde .env
if (file_exists(__DIR__ . '/../../.env')) {
    $env = parse_ini_file(__DIR__ . '/../../.env');
    foreach ($env as $key => $value) {
        putenv("{$key}={$value}");
    }
}

const MAX_CONVERSATION_CONTEXT = 12;
const MAX_CATALOG_ITEMS = 80;
const MAX_CONVERSATION_TEXT_LENGTH = 1600;

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = getAllowedOrigins();
$originAllowed = isOriginAllowed($origin, $allowedOrigins);

if ($originAllowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (!$originAllowed) {
        http_response_code(403);
        echo json_encode(['error' => 'Origen no autorizado.']);
        exit;
    }
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido. Usa POST.']);
    exit;
}

if (!$originAllowed) {
    http_response_code(403);
    echo json_encode(['error' => 'Origen no autorizado.']);
    exit;
}

rateLimit();

$apiKey = getenv('GEMINI_API_KEY') ?: '';
if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['error' => 'Falta configurar GEMINI_API_KEY en el servidor.']);
    exit;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw ?: '', true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido.']);
    exit;
}

$message = trim((string)($input['message'] ?? ''));
$salesMode = (bool)($input['salesMode'] ?? true);
$clientName = trim((string)($input['clientName'] ?? ''));
$conversation = is_array($input['conversation'] ?? null) ? $input['conversation'] : [];
$inventoryContext = is_array($input['inventoryContext'] ?? null) ? $input['inventoryContext'] : ['total' => 0, 'items' => []];
$image = is_array($input['image'] ?? null) ? $input['image'] : null;

if ($message === '' && $image === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Debes enviar texto o imagen.']);
    exit;
}

$allowedMime = ['image/jpeg', 'image/png'];
$imagePart = null;
if ($image !== null) {
    $mime = (string)($image['mimeType'] ?? '');
    $b64 = (string)($image['data'] ?? '');
    if (!in_array($mime, $allowedMime, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Formato de imagen no permitido.']);
        exit;
    }
    $binary = base64_decode($b64, true);
    if ($binary === false || strlen($binary) > 4 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['error' => 'Imagen inválida o mayor a 4MB.']);
        exit;
    }
    $imagePart = [
        'inline_data' => [
            'mime_type' => $mime,
            'data' => $b64
        ]
    ];
}

$model = getenv('GEMINI_MODEL') ?: 'gemini-1.5-flash';
$url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);

$systemInstruction = buildSystemInstruction($salesMode);
$contents = buildConversation($conversation, $message, $imagePart, $clientName, $inventoryContext);

$payload = [
    'systemInstruction' => [
        'parts' => [['text' => $systemInstruction]]
    ],
    'contents' => $contents,
    'generationConfig' => [
        'temperature' => 0.5,
        'topK' => 32,
        'topP' => 0.9,
        'maxOutputTokens' => 700
    ],
    'safetySettings' => [
        ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
        ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
        ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
        ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE']
    ]
];

$response = httpPostJson($url, $payload);
if ($response['status'] < 200 || $response['status'] >= 300) {
    http_response_code(502);
    logProviderError($response['body']);
    echo json_encode(['error' => 'Error al consultar Gemini.']);
    exit;
}

$data = json_decode($response['body'], true);
$reply = extractReply($data);
if ($reply === '') {
    http_response_code(502);
    echo json_encode(['error' => 'Gemini no devolvió texto utilizable.']);
    exit;
}

logRequest($message, $image !== null);
echo json_encode(['reply' => $reply]);
exit;

function buildSystemInstruction(bool $salesMode): string
{
    $base = [
        'Eres un asistente experto en perfumes y ventas para Fitoscents.',
        'Responde siempre en español claro y breve.',
        'No inventes stock, precio ni disponibilidad.',
        'Si falta información del catálogo, dilo explícitamente y solicita confirmación.',
        'Si el usuario envía imagen, úsala para ayudar a identificar o validar presentación.',
        'Aclara que el análisis visual puede fallar y pide foto adicional cuando haya dudas.',
        'No des consejos médicos ni afirmaciones de salud sobre fragancias.',
    ];

    if ($salesMode) {
        $base[] = 'Modo ventas activo: enfócate en cierre, manejo de objeciones, upsell y texto listo para WhatsApp cuando tenga sentido.';
        $base[] = 'Incluye llamada a la acción al final cuando sea oportuno.';
    }

    return implode("\n", $base);
}

function buildConversation(array $conversation, string $message, ?array $imagePart, string $clientName, array $inventoryContext): array
{
    $contents = [];

    $catalogo = summarizeInventory($inventoryContext);
    $contextText = "Contexto de negocio:\nCliente: " . ($clientName !== '' ? $clientName : 'no especificado') . "\n" . $catalogo;
    $contents[] = [
        'role' => 'user',
        'parts' => [['text' => $contextText]]
    ];

    $recent = array_slice($conversation, -MAX_CONVERSATION_CONTEXT);
    if ($message !== '' && !empty($recent)) {
        $last = end($recent);
        $lastText = trim((string)($last['text'] ?? ''));
        $lastRole = (string)($last['role'] ?? '');
        if ($lastRole === 'user' && $lastText === $message) {
            array_pop($recent);
        }
    }
    foreach ($recent as $msg) {
        $role = ($msg['role'] ?? '') === 'assistant' ? 'model' : 'user';
        $text = trim((string)($msg['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $contents[] = [
            'role' => $role,
            'parts' => [['text' => mb_substr($text, 0, MAX_CONVERSATION_TEXT_LENGTH)]]
        ];
    }

    $userParts = [];
    if ($message !== '') {
        $userParts[] = ['text' => $message];
    }
    if ($imagePart !== null) {
        $userParts[] = $imagePart;
    }
    $contents[] = [
        'role' => 'user',
        'parts' => $userParts
    ];

    return $contents;
}

function summarizeInventory(array $inventoryContext): string
{
    $total = (int)($inventoryContext['total'] ?? 0);
    $items = is_array($inventoryContext['items'] ?? null) ? $inventoryContext['items'] : [];
    $items = array_slice($items, 0, MAX_CATALOG_ITEMS);

    $lines = ["Total productos en inventario: {$total}."];
    foreach ($items as $item) {
        $marca = trim((string)($item['marca'] ?? ''));
        $nombre = trim((string)($item['nombre'] ?? ''));
        $precio = (float)($item['precioVenta'] ?? 0);
        $ml = (float)($item['disponibleMl'] ?? 0);
        $estado = trim((string)($item['estado'] ?? ''));
        if ($nombre === '') {
            continue;
        }
        $display = ($marca !== '' ? "{$marca} " : '') . $nombre;
        $lines[] = "- {$display} | precio: $" . number_format($precio, 2, '.', '') . " MXN | ml: {$ml} | estado: " . ($estado !== '' ? $estado : 'sin estado');
    }

    return implode("\n", $lines);
}

function httpPostJson(string $url, array $payload): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 45,
    ]);

    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        return ['status' => 0, 'body' => $error];
    }

    return ['status' => $status, 'body' => $body];
}

function extractReply(array $data): string
{
    $parts = $data['candidates'][0]['content']['parts'] ?? [];
    if (!is_array($parts)) {
        return '';
    }

    $text = '';
    foreach ($parts as $part) {
        if (isset($part['text']) && is_string($part['text'])) {
            $text .= $part['text'];
        }
    }

    return trim($text);
}

function rateLimit(): void
{
    $ip = getClientIp();
    $hash = hash('sha256', $ip);
    $file = sys_get_temp_dir() . '/gemini_assistant_rate_' . $hash . '.json';

    $windowSeconds = 600;
    $maxRequests = 30;
    $now = time();

    $fp = fopen($file, 'c+');
    if ($fp === false) {
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo procesar límite de solicitudes.']);
        exit;
    }

    $allowed = true;
    if (flock($fp, LOCK_EX)) {
        $raw = stream_get_contents($fp);
        $saved = json_decode($raw ?: '', true);
        $data = ['count' => 0, 'start' => $now];
        if (is_array($saved) && isset($saved['count'], $saved['start'])) {
            $data = $saved;
        }

        if (($now - (int)$data['start']) > $windowSeconds) {
            $data = ['count' => 0, 'start' => $now];
        }
        $data['count'] = (int)$data['count'] + 1;
        if ((int)$data['count'] > $maxRequests) {
            $allowed = false;
        }

        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data));
        fflush($fp);
        flock($fp, LOCK_UN);
    } else {
        fclose($fp);
        http_response_code(500);
        echo json_encode(['error' => 'No se pudo bloquear control de solicitudes.']);
        exit;
    }
    fclose($fp);

    if (!$allowed) {
        http_response_code(429);
        echo json_encode(['error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.']);
        exit;
    }
}

function logRequest(string $message, bool $hasImage): void
{
    $ip = getClientIp();
    $line = sprintf(
        "[%s] ip=%s chars=%d image=%s\n",
        date('c'),
        $ip,
        mb_strlen($message),
        $hasImage ? 'yes' : 'no'
    );
    @file_put_contents(sys_get_temp_dir() . '/gemini_assistant.log', $line, FILE_APPEND | LOCK_EX);
}

function logProviderError(string $body): void
{
    $sanitized = preg_replace('/\s+/', ' ', $body);
    $sanitized = is_string($sanitized) ? mb_substr($sanitized, 0, 800) : 'error_no_legible';
    $line = sprintf("[%s] provider_error=%s\n", date('c'), $sanitized);
    @file_put_contents(sys_get_temp_dir() . '/gemini_assistant_error.log', $line, FILE_APPEND | LOCK_EX);
}

function getClientIp(): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (filter_var($remote, FILTER_VALIDATE_IP)) {
        return $remote;
    }
    return 'unknown';
}

function getAllowedOrigins(): array
{
    $env = trim(getenv('ALLOWED_ORIGINS') ?: '');
    if ($env !== '') {
        $parts = array_map('trim', explode(',', $env));
        $parts = array_values(array_filter($parts, static fn ($o) => $o !== ''));
        return array_values(array_unique(array_map('normalizeOrigin', $parts)));
    }

    $host = $_SERVER['HTTP_HOST'] ?? '';
    $origins = [
        'https://rodolfohubster.github.io',
        'http://localhost',
        'http://127.0.0.1',
    ];

    if ($host !== '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $origins[] = "{$scheme}://{$host}";
    }

    return array_values(array_unique(array_map('normalizeOrigin', $origins)));
}

function isOriginAllowed(string $origin, array $allowedOrigins): bool
{
    $origin = normalizeOrigin($origin);
    if ($origin === '') {
        return false;
    }
    foreach ($allowedOrigins as $allowed) {
        if (strcasecmp($origin, normalizeOrigin($allowed)) === 0) {
            return true;
        }
    }
    return false;
}

function normalizeOrigin(string $origin): string
{
    $origin = trim($origin);
    return rtrim($origin, '/');
}
