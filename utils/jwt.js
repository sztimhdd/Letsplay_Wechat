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
        // 使用更安全的编码方式
        const bytes = new TextEncoder().encode(str);
        const base64 = wx.arrayBufferToBase64(bytes.buffer);
        return base64url.escape(base64);
    },
    decode: (str) => {
        const base64 = base64url.unescape(str);
        const bytes = wx.base64ToArrayBuffer(base64);
        return new TextDecoder().decode(bytes);
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