const http = require('http');

const data = JSON.stringify({
  projectId: "test",
  userId: "me",
  event: {
    eventType: "message",
    sourceType: "claude",
    scope: {
      type: "project"
    },
    contentText: "用户偏好深色模式界面，工作时间是北京时区 9点 到 17点"
  }
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/ingest',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
