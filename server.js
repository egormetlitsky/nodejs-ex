var http = require('http'),
    net = require('net'),
    url = require('url'),
    settings = {
        port: 8080,
        username: "mcyahor",
        password: "passme"
    };

var server = http.createServer(function(request, response) {
    switch (Auth(request)) {
        case 407:
            response.writeHead(407, {
                "Proxy-Authenticate": "Basic realm=\"qwerty\""
            });
            return response.end();
        case 401:
            response.writeHead(401, {
                'Content-Type': 'text/html; charset=utf-8'
            });
            return response.end("Unauthorized");
    }

    console.log("http: ", request.connection.remoteAddress, "\t", request.url);

    var ph = url.parse(request.url);

    var proxyRequest = http.request({
        port: ph.port,
        hostname: ph.hostname,
        method: request.method,
        path: ph.path,
        headers: request.headers
    });

    proxyRequest.on('response', function(proxyResponse) {
        proxyResponse.on('data', (chunk) => response.write(chunk, 'binary'));
        proxyResponse.on('end', () => response.end());
        proxyResponse.on('error', () => response.end());
        response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    });

    request.on('data', (chunk) => proxyRequest.write(chunk, 'binary'));
    request.on('end', () => proxyRequest.end());
    request.on('error', () => proxyRequest.end());

}).on('connect', function(request, socketRequest, head) {
    if (Auth(request)) {
        socketRequest.end(
            "HTTP/" + request.httpVersion + " 407 Proxy Authentication Required\r\n" +
            "Proxy-Authenticate: Basic realm=\"qwertys\"\r\n" +
            "\r\n"
        );
        return;
    }

    console.log("https:", request.connection.remoteAddress, "\t", request.url);

    var ph = url.parse('http://' + request.url);

    var socket = net.connect(ph.port, ph.hostname, function() {
        socket.write(head);
        socketRequest.write("HTTP/" + request.httpVersion + " 200 Connection established\r\n\r\n");
    });

    socket.on('data', (chunk) => socketRequest.write(chunk));
    socket.on('end', () => socketRequest.end());
    socket.on('error', function() {
        socketRequest.write("HTTP/" + request.httpVersion + " 500 Connection error\r\n\r\n");
        socketRequest.end();
    });

    socketRequest.on('data', (chunk) => socket.write(chunk));
    socketRequest.on('end', () => socket.end());
    socketRequest.on('error', () => socket.end());
}).listen(settings.port);

function Auth(request) {
    if (!request.headers["proxy-authorization"]) {
        console.log("auth: ", request.connection.remoteAddress, "\t", 407);
        return 407;
    } else {
        var base64 = request.headers["proxy-authorization"].replace(/^.+?\s/, ""),
            auth = new Buffer(base64, 'base64').toString().split(/:/);
        if (auth[0] !== settings.username || auth[1] !== settings.password) {
            console.log("auth>", request.connection.remoteAddress, "\t", 401, auth[0], auth[1]);
            return 401;
        }
    }
}

process.on("uncaughtException", function(e) { // Игнорирование ошибок
    console.error("uncaughtException", e.stack);
});
