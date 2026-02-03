const crypto = require('crypto');

const key = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAu6B334VsBsKC9i4Z+lFi0bzIcearDg/ll8nreswZgY7Dc1gR
ZaWg19odblUqrgCMMxvnJ28thyM/tqTbXCVppqJXyIjMUoD+knGN8KVqEbbgiUSR
UuA6C4VsPcborkCNVRduB9QeNrKmHUVNyRiS7N9CYPshjrKSlgis5gYzD2UMKeV5
WIGdzJ6A0TYDP/+2ecTz025DbiIQslOyBm/09neq++e1BxPURjPPQVbTpZURYNtW
rrNOLaHbIFSkPokC9/N9FbMUJ0DJi5coba3fla0PCTqrp8CIDADpRmY8nB2/tHFr
gdXQYFo/fYq9dLbE5vVBhTfA4BU5odZkbHIJfQIDAQABAoIBAAwTZeOy+KLuvfMO
QInF1zBckCIUkInVKBe+3TMIE9Qs1hOEZYo/QLzjwuUpAhg03NElSJlXJH0AHcep
kJy7o7Mf27qCY3Qj7T6LpHEKlGsTdBwhl6DX4aSAL9lCBhPA/9esLF7AnjkzAlH7
9eetdzdbnzASubQvdhPF9yrO11Z0ND+9+KG5yWfJNMfBbD6jN4CKbFBZGCRVxKER
vpiwJ/1w4BqMBwObuCSKo5krFcM0OpeceY/85jJQPkp5Qg/5rsaIycyTpGSuJm9d
TjeXcMzJmJnUPumTmeo9IpBGECyIlDq0TNklnFbcs/RhMd+rFTa72Yvtr68hm7jw
Ug9sX4ECgYEA3VyUsMxwmyTDmYqP6JUMf1fwRP9vTiN39HcDt7LirHSt61QnmbdZ
aZO/JMLJTTx8GgbiUePx3BqVYU5FBD/zjlHr22YcG+2FN8SlMRHR4EJpYBMi4MSU
pYw6rugd306PWZXOvus04NSkqVBKFnU4KtqZm6ZxVu+v0FWgyBq5jq0CgYEA2PyF
UfkLW6gPjMk/DHZNRjLURFO6d7F7j70r01XvE/jQVMAkCGXGkgKFpr48/Ze1r592
GE6NHh/EdUkqqUQnElBb2isSW9zXLWvsKkkv2a6kld6dRUD4ctXFsZqSn+gnijbh
VfQRIFBJ/YfbZvnaUJ8rMs+mBxUY4yJzVbBf0BECgYAiixb8+/o6i6Mma7QHVHMN
0DhDXCUPaYOHl6bx3K14wgB977T6TN1cF11FrEvjjKPFH/vjUZHlihRzidZFUoF8
XRZUN3v9c7RNPpeUr7Yzq8lr37CaqLKVnuttbfVzanv+O912d5fZ2fUUIt5c4M/y
CAjefDvFmEO0XBhqAZmhRQKBgHcW+REJb6tpbMdnOHxdfYHWqduqXIAO3/L+70u5
MVMzzxuErQIS4c4HJlViudSw7B2slkM28YqkAs4gTxLBffQ2OINf+l6CsXKTdfWr
X2DI0joTCRwWUYWtQCh+3pR29SSNhFUJdFDY4BMO+mLlJGX1Rd9ISiY+9P7MTKKt
/5gRAoGAbhr1PW2SVEhkvixMaVrcvCU9edqVXQIf7nwPHxuwHjah/f8Ir2HIjKtL
9SBONMG3GUPbCb/VWlD6k4QV6dyrG2NN3pIJ/YwK4is6ZLC+nn2M3ThurmuONr+u
m5w1Le5gBJjwMHfjVjlKoH62kS66vuVKp7W+/3RKbYsx3HaOFVc=
-----END RSA PRIVATE KEY-----`;

const privateKey = crypto.createPrivateKey(key);
const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' });

// Output as single line with \n escapes for .env file
const envFormat = pkcs8.replace(/\n/g, '\\n');
console.log('PKCS#8 key for .env:');
console.log(`DOCUSIGN_PRIVATE_KEY="${envFormat}"`);
