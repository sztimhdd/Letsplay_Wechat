// jwt.js
import JSEncrypt from './jsencrypt.min.js';
import CryptoJS from './crypto-js.min.js';

const base64url = {
    unescape: (str) => {
        return (str + '==='.slice((str.length + 3) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/');
    },
    escape: (str) => {
        return str.replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    },
    encode: (str) => {
        // 使用更简单的方式进行 UTF-8 编码
        const utf8Bytes = [];
        for (let i = 0; i < str.length; i++) {
            let charCode = str.charCodeAt(i);
            if (charCode < 0x80) {
                utf8Bytes.push(charCode);
            } else if (charCode < 0x800) {
                utf8Bytes.push(0xc0 | (charCode >> 6),
                              0x80 | (charCode & 0x3f));
            } else if (charCode < 0xd800 || charCode >= 0xe000) {
                utf8Bytes.push(0xe0 | (charCode >> 12),
                              0x80 | ((charCode >> 6) & 0x3f),
                              0x80 | (charCode & 0x3f));
            } else {
                // 处理 UTF-16 代理对
                i++;
                charCode = 0x10000 + (((charCode & 0x3ff) << 10)
                          | (str.charCodeAt(i) & 0x3ff));
                utf8Bytes.push(0xf0 | (charCode >> 18),
                              0x80 | ((charCode >> 12) & 0x3f),
                              0x80 | ((charCode >> 6) & 0x3f),
                              0x80 | (charCode & 0x3f));
            }
        }
        // 将UTF-8字节数组转换为Base64
        const base64 = wx.arrayBufferToBase64(new Uint8Array(utf8Bytes).buffer);
        return base64url.escape(base64);
    },
    decode: (str) => {
        const base64 = base64url.unescape(str);
        const bytes = new Uint8Array(wx.base64ToArrayBuffer(base64));
        
        // 解码 UTF-8
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            let c = bytes[i];
            if (c < 0x80) {
                result += String.fromCharCode(c);
                i++;
            } else if (c < 0xe0) {
                result += String.fromCharCode(
                    ((c & 0x1f) << 6) |
                    (bytes[i + 1] & 0x3f)
                );
                i += 2;
            } else if (c < 0xf0) {
                result += String.fromCharCode(
                    ((c & 0x0f) << 12) |
                    ((bytes[i + 1] & 0x3f) << 6) |
                    (bytes[i + 2] & 0x3f)
                );
                i += 3;
            } else {
                const codePoint = ((c & 0x07) << 18) |
                    ((bytes[i + 1] & 0x3f) << 12) |
                    ((bytes[i + 2] & 0x3f) << 6) |
                    (bytes[i + 3] & 0x3f);
                result += String.fromCodePoint(codePoint);
                i += 4;
            }
        }
        return result;
    }
};

// RSA-SHA256 签名实现
const crypto = {
    async sign(data, privateKey) {
        try {
            // 创建 JSEncrypt 实例
            const encrypt = new JSEncrypt();
            encrypt.setPrivateKey(privateKey);

            // 直接对数据进行签名，不需要额外的哈希
            const signature = encrypt.sign(data, CryptoJS.SHA256, 'sha256');
            if (!signature) {
                throw new Error('签名生成失败');
            }

            return signature;
        } catch (err) {
            console.error('RSA签名失败:', err);
            throw err;
        }
    }
};

export class GoogleAuth {
    constructor(credentials) {
        console.log('创建 GoogleAuth 实例...');
        if (!credentials) {
            throw new Error('credentials 是必需的');
        }
        
        // 预处理私钥，确保格式正确
        this.credentials = {
            ...credentials,
            private_key: credentials.private_key.replace(/\\n/g, '\n')
        };
        this.token = null;
        this.tokenExpiry = 0;
        console.log('GoogleAuth 实例创建成功');
    }

    // 生成 JWT
    async createJWT() {
        console.log('开始生成 JWT...');
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 3600; // 1小时后过期

        const header = {
            alg: 'RS256',
            typ: 'JWT',
            kid: this.credentials.private_key_id
        };

        const payload = {
            iss: this.credentials.client_email,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            aud: 'https://oauth2.googleapis.com/token',
            exp: expiry,
            iat: now
        };

        // 编码 header 和 payload
        const encodedHeader = base64url.encode(JSON.stringify(header));
        const encodedPayload = base64url.encode(JSON.stringify(payload));
        
        // 创建签名内容
        const signContent = `${encodedHeader}.${encodedPayload}`;
        
        try {
            // 使用私钥签名
            const signature = await crypto.sign(signContent, this.credentials.private_key);
            
            // 组合 JWT
            const jwt = `${signContent}.${base64url.escape(signature)}`;
            console.log('JWT 生成成功');
            return jwt;
            
        } catch (err) {
            console.error('JWT生成失败:', err);
            throw err;
        }
    }

    // 获取访问令牌
    async getAccessToken() {
        try {
            // 检查缓存的令牌是否还有效
            if (this.token && Date.now() < this.tokenExpiry - 60000) {
                return this.token;
            }

            console.log('开始获取新的访问令牌...');
            const jwt = await this.createJWT();
            
            const response = await new Promise((resolve, reject) => {
                wx.request({
                    url: 'https://oauth2.googleapis.com/token',
                    method: 'POST',
                    header: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    data: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
                    success: (res) => {
                        if (res.statusCode === 200 && res.data.access_token) {
                            console.log('成功获取访问令牌');
                            resolve(res.data);
                        } else {
                            console.error('获取令牌失败:', res.data);
                            reject(new Error('获取token失败: ' + JSON.stringify(res.data)));
                        }
                    },
                    fail: (err) => {
                        console.error('请求失败:', err);
                        reject(err);
                    }
                });
            });

            this.token = response.access_token;
            this.tokenExpiry = Date.now() + (response.expires_in * 1000);
            return this.token;

        } catch (err) {
            console.error('获取访问令牌失败:', err);
            throw err;
        }
    }
} 