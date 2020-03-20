function sendMessage(key, value) {
  console.log(JSON.stringify({
    key,
    value,
    headers: { 'content-type': 'application/json' },
  }));
}

sendMessage('1', '1');
sendMessage('2', '2');
sendMessage('3', '3');
sendMessage('4', '4');
