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
        try {
            console.log('开始Base64URL编码，输入字符串长度:', str.length);
            
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
            
            console.log('UTF-8编码完成，字节数组长度:', utf8Bytes.length);
            
            // 将UTF-8字节数组转换为Base64
            const base64 = wx.arrayBufferToBase64(new Uint8Array(utf8Bytes).buffer);
            const result = base64url.escape(base64);
            
            console.log('Base64URL编码完成，结果长度:', result.length);
            return result;
        } catch (error) {
            console.error('Base64URL编码失败:', error);
            throw error;
        }
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
            console.log('开始RSA签名过程...');
            
            // 确保私钥格式正确
            let formattedKey = privateKey;
            
            // 处理可能的换行符问题
            formattedKey = formattedKey.replace(/\\n/g, '\n');
            
            // 检查私钥格式
            if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
                console.error('私钥格式不正确，缺少BEGIN标记');
                throw new Error('私钥格式不正确');
            }
            
            console.log('私钥格式检查通过');
            
            // 创建 JSEncrypt 实例
            const encrypt = new JSEncrypt();
            encrypt.setPrivateKey(formattedKey);
            
            // 尝试使用标准的SHA256签名方法
            console.log('使用标准的SHA256签名方法');
            
            // 直接对数据进行签名，JSEncrypt内部会处理哈希
            const signature = encrypt.sign(data, CryptoJS.SHA256, "sha256");
            
            if (!signature) {
                console.error('签名生成失败');
                throw new Error('签名生成失败');
            }
            
            console.log('签名生成成功，长度:', signature.length);
            return signature;
        } catch (err) {
            console.error('RSA签名失败:', err);
            throw err;
        }
    }
};

// 创建一个全局令牌缓存
const tokenCache = {
    token: null,
    tokenExpiry: 0,
    isTokenRefreshing: false,
    refreshPromise: null
};

export class GoogleAuth {
    constructor(credentials) {
        console.log('创建 GoogleAuth 实例...');
        if (!credentials) {
            throw new Error('credentials 是必需的');
        }
        
        // 确保凭证中的私钥格式正确
        const formattedCredentials = { ...credentials };
        if (formattedCredentials.private_key) {
            formattedCredentials.private_key = formattedCredentials.private_key.replace(/\\n/g, '\n');
        }
        
        this.credentials = formattedCredentials;
        this.token = null;
        this.tokenExpiry = 0;
        console.log('GoogleAuth 实例创建成功');
    }

    // 生成 JWT
    async createJWT() {
        console.log('开始生成 JWT...');
        const now = Math.floor(Date.now() / 1000);
        const expiry = now + 3600; // 1小时后过期

        console.log('当前时间戳(iat):', now);
        console.log('过期时间戳(exp):', expiry);
        console.log('时间差(秒):', expiry - now);

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
            iat: now,
            sub: this.credentials.client_email  // 添加sub声明，通常设置为与iss相同
        };

        console.log('JWT header:', JSON.stringify(header));
        console.log('JWT payload:', JSON.stringify(payload));
        console.log('服务账号邮箱(iss):', this.credentials.client_email);
        console.log('请求范围(scope):', payload.scope);
        console.log('目标受众(aud):', payload.aud);

        // 编码 header 和 payload
        const encodedHeader = base64url.encode(JSON.stringify(header));
        const encodedPayload = base64url.encode(JSON.stringify(payload));
        
        // 创建签名内容
        const signContent = `${encodedHeader}.${encodedPayload}`;
        
        try {
            // 使用私钥签名
            console.log('开始签名JWT...');
            console.log('签名内容长度:', signContent.length);
            const signature = await crypto.sign(signContent, this.credentials.private_key);
            console.log('JWT签名完成');
            
            // 组合 JWT
            const jwt = `${signContent}.${base64url.escape(signature)}`;
            console.log('JWT 生成成功，总长度:', jwt.length);
            
            // 验证JWT格式
            const parts = jwt.split('.');
            if (parts.length !== 3) {
                console.error('JWT格式错误，应该有3个部分，实际有', parts.length);
                throw new Error('JWT格式错误');
            }
            
            // 解码JWT部分以验证内容
            try {
                const decodedHeader = JSON.parse(base64url.decode(parts[0]));
                const decodedPayload = JSON.parse(base64url.decode(parts[1]));
                console.log('解码后的header:', JSON.stringify(decodedHeader));
                console.log('解码后的payload:', JSON.stringify(decodedPayload));
            } catch (e) {
                console.error('JWT解码失败:', e);
            }
            
            return jwt;
            
        } catch (err) {
            console.error('JWT生成失败:', err);
            throw err;
        }
    }

    // 获取访问令牌
    async getAccessToken() {
        try {
            // 使用全局令牌缓存
            // 检查缓存的令牌是否还有效（至少还有5分钟有效期）
            if (tokenCache.token && Date.now() < tokenCache.tokenExpiry - 300000) {
                console.log('使用全局缓存的访问令牌');
                return tokenCache.token;
            }

            // 如果已经有一个正在进行的令牌刷新请求，直接返回该Promise
            if (tokenCache.isTokenRefreshing && tokenCache.refreshPromise) {
                console.log('已有令牌刷新请求正在进行，等待其完成...');
                return tokenCache.refreshPromise;
            }

            // 标记正在刷新令牌
            tokenCache.isTokenRefreshing = true;
            
            // 创建新的刷新Promise
            tokenCache.refreshPromise = (async () => {
                try {
                    console.log('开始获取新的访问令牌...');
                    console.log('当前时间戳:', Math.floor(Date.now() / 1000));
                    console.log('当前时间:', new Date().toISOString());
                    
                    const jwt = await this.createJWT();
                    
                    // 打印JWT的组成部分（仅用于调试）
                    const jwtParts = jwt.split('.');
                    console.log('JWT header长度:', jwtParts[0].length);
                    console.log('JWT payload长度:', jwtParts[1].length);
                    console.log('JWT signature长度:', jwtParts[2].length);
                    
                    // 打印完整的请求数据，用于调试
                    const requestData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
                    console.log('请求数据长度:', requestData.length);
                    
                    const response = await new Promise((resolve, reject) => {
                        wx.request({
                            url: 'https://oauth2.googleapis.com/token',
                            method: 'POST',
                            header: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            data: requestData,
                            success: (res) => {
                                console.log('令牌请求响应状态码:', res.statusCode);
                                if (res.statusCode === 200 && res.data.access_token) {
                                    console.log('成功获取访问令牌');
                                    resolve(res.data);
                                } else {
                                    console.error('获取令牌失败:', JSON.stringify(res.data));
                                    
                                    // 详细错误处理
                                    if (res.data && res.data.error) {
                                        console.error('错误类型:', res.data.error);
                                        console.error('错误描述:', res.data.error_description || '无详细描述');
                                        
                                        if (res.data.error === 'invalid_grant') {
                                            if (res.data.error_description === 'Invalid JWT Signature.') {
                                                console.error('JWT签名无效，请检查private_key格式是否正确');
                                            } else if (res.data.error_description && res.data.error_description.includes('expired')) {
                                                console.error('JWT已过期，请检查系统时间是否正确');
                                            } else if (res.data.error_description && res.data.error_description.includes('Missing')) {
                                                console.error('JWT缺少必需的声明，请检查payload结构');
                                            } else if (res.data.error_description && res.data.error_description.includes('Invalid')) {
                                                console.error('JWT包含无效的声明，请检查payload结构');
                                            }
                                        } else if (res.data.error === 'invalid_request') {
                                            console.error('请求格式无效，请检查请求参数');
                                        } else if (res.data.error === 'unauthorized_client') {
                                            console.error('服务账号未授权，请检查服务账号权限');
                                        }
                                        
                                        // 记录完整的错误信息
                                        console.error('完整错误信息:', res.data);
                                    }
                                    
                                    reject(new Error('获取token失败: ' + JSON.stringify(res.data)));
                                }
                            },
                            fail: (err) => {
                                console.error('请求失败:', err);
                                reject(err);
                            }
                        });
                    });

                    // 更新全局令牌缓存
                    tokenCache.token = response.access_token;
                    tokenCache.tokenExpiry = Date.now() + response.expires_in * 1000;
                    console.log('令牌将在以下时间过期:', new Date(tokenCache.tokenExpiry).toISOString());
                    
                    return tokenCache.token;
                } finally {
                    // 无论成功还是失败，都标记刷新完成
                    tokenCache.isTokenRefreshing = false;
                    tokenCache.refreshPromise = null;
                }
            })();
            
            // 返回刷新Promise
            return tokenCache.refreshPromise;
        } catch (err) {
            console.error('获取访问令牌失败:', err);
            // 重置刷新状态
            tokenCache.isTokenRefreshing = false;
            tokenCache.refreshPromise = null;
            throw err;
        }
    }
} 