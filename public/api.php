<?php

/**
 * HeapBeat PHP gateway.
 *
 * PHP khong con luu state.json/revision/patch. Moi request nghiep vu duoc
 * chuyen thang toi tien trinh C11; Max-Heap, vote, CDLL va SpamGuard chi duoc
 * thay doi trong backend C.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('HB_MAX_BODY_BYTES', 64 * 1024);
define('HB_MAX_RESPONSE_BYTES', 128 * 1024);

function fail($status, $code, $message) {
    http_response_code($status);
    echo json_encode(array('code' => $code, 'message' => $message));
    exit;
}

function routes() {
    return array(
        'health' => array('GET', '/health'),
        'catalog' => array('GET', '/api/catalog'),
        'queue' => array('GET', '/api/queue'),
        'player' => array('GET', '/api/player'),
        'state' => array('GET', '/api/state'),
        'request' => array('POST', '/api/request'),
        'vote' => array('POST', '/api/vote'),
        'remove' => array('POST', '/api/queue/remove'),
        'clear' => array('POST', '/api/queue/clear'),
        'shuffle' => array('POST', '/api/queue/shuffle'),
        'next' => array('POST', '/api/player/next'),
        'previous' => array('POST', '/api/player/previous'),
        'reset' => array('POST', '/api/reset'),
    );
}

function write_all($socket, $data) {
    $offset = 0;
    $length = strlen($data);
    while ($offset < $length) {
        $written = fwrite($socket, substr($data, $offset));
        if ($written === false || $written === 0) {
            return false;
        }
        $offset += $written;
    }
    return true;
}

$route_name = isset($_GET['route']) ? (string) $_GET['route'] : '';
$route_table = routes();
if (!isset($route_table[$route_name])) {
    fail(404, 'ROUTE_NOT_FOUND', 'Khong tim thay API backend C.');
}

list($expected_method, $backend_path) = $route_table[$route_name];
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== $expected_method) {
    header('Allow: ' . $expected_method);
    fail(405, 'METHOD_NOT_ALLOWED', 'HTTP method khong hop le.');
}

$body = $method === 'POST' ? (string) file_get_contents('php://input') : '';
if (strlen($body) > HB_MAX_BODY_BYTES) {
    fail(413, 'BODY_TOO_LARGE', 'JSON body qua lon.');
}
if (($route_name === 'request' || $route_name === 'vote' ||
     $route_name === 'remove') && !is_object(json_decode($body))) {
    fail(400, 'INVALID_JSON', 'Can JSON object hop le.');
}

$host = getenv('HEAPBEAT_C_HOST');
$host = $host === false || trim($host) === '' ? '127.0.0.1' : trim($host);
$port_raw = getenv('HEAPBEAT_C_PORT');
$port = filter_var($port_raw, FILTER_VALIDATE_INT, array(
    'options' => array('min_range' => 1, 'max_range' => 65535),
));
$port = $port === false ? 8081 : $port;

$error_number = 0;
$error_message = '';
$socket = @stream_socket_client(
    'tcp://' . $host . ':' . $port,
    $error_number,
    $error_message,
    2.0,
    STREAM_CLIENT_CONNECT
);
if ($socket === false) {
    fail(503, 'C_BACKEND_UNAVAILABLE', 'Hay khoi dong heapbeat-backend cong 8081.');
}

stream_set_timeout($socket, 5);
$request =
    $method . ' ' . $backend_path . " HTTP/1.1\r\n" .
    'Host: ' . $host . ':' . $port . "\r\n" .
    "Content-Type: application/json; charset=utf-8\r\n" .
    'Content-Length: ' . strlen($body) . "\r\n" .
    "Connection: close\r\n\r\n" .
    $body;

if (!write_all($socket, $request)) {
    fclose($socket);
    fail(502, 'C_BACKEND_WRITE_FAILED', 'Khong gui duoc request toi C.');
}

$response = stream_get_contents($socket, HB_MAX_RESPONSE_BYTES + 1);
$metadata = stream_get_meta_data($socket);
fclose($socket);
if (!empty($metadata['timed_out'])) {
    fail(504, 'C_BACKEND_TIMEOUT', 'Backend C phan hoi qua cham.');
}
if ($response === false || strlen($response) > HB_MAX_RESPONSE_BYTES) {
    fail(502, 'C_BACKEND_INVALID_RESPONSE', 'Response C khong hop le.');
}

$separator = strpos($response, "\r\n\r\n");
if ($separator === false) {
    fail(502, 'C_BACKEND_MALFORMED_RESPONSE', 'Response C sai dinh dang HTTP.');
}
$header_block = substr($response, 0, $separator);
$response_body = substr($response, $separator + 4);
$header_lines = explode("\r\n", $header_block);
if (!preg_match('/^HTTP\/1\.[01] ([0-9]{3}) /', $header_lines[0], $matches)) {
    fail(502, 'C_BACKEND_INVALID_STATUS', 'Khong doc duoc status tu C.');
}

$declared_length = null;
foreach ($header_lines as $line) {
    if (stripos($line, 'Content-Length:') === 0) {
        $declared_length = (int) trim(substr($line, strlen('Content-Length:')));
        break;
    }
}
if ($declared_length === null || strlen($response_body) !== $declared_length) {
    fail(502, 'C_BACKEND_LENGTH_MISMATCH', 'Response C bi thieu du lieu.');
}

http_response_code((int) $matches[1]);
header('X-HeapBeat-Engine: C11');
echo $response_body;
