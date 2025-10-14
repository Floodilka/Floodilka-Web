import { BACKEND_URL } from '../constants';

class ApiService {
  constructor() {
    this.baseURL = BACKEND_URL;
    this.cache = new Map();
  }

  getAuthHeaders(includeJson = true) {
    let token = null;

    try {
      token = localStorage.getItem('token');
    } catch (err) {
      // localStorage может быть недоступен (SSR / privacy режим)
    }

    const headers = {
      Accept: 'application/json'
    };

    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const { cache: cacheOptions, ...fetchOptions } = options;
    const url = `${this.baseURL}${endpoint}`;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const cacheKey = cacheOptions?.key || endpoint;
    const ttl = cacheOptions?.ttl ?? 10_000;

    if (method === 'GET' && cacheOptions) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const isFormData = fetchOptions.body instanceof FormData;
    const config = {
      ...fetchOptions,
      credentials: fetchOptions.credentials || 'include',
      headers: {
        ...this.getAuthHeaders(!isFormData),
        ...fetchOptions.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (method === 'GET' && cacheOptions) {
        this.cache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + ttl
        });
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  invalidateCache(prefix) {
    if (!prefix) {
      this.cache.clear();
      return;
    }

    Array.from(this.cache.keys())
      .filter(key => key.startsWith(prefix))
      .forEach(key => this.cache.delete(key));
  }

  // Серверы
  async getServers() {
    return this.request('/api/servers');
  }

  async createServer(data) {
    const result = await this.request('/api/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.invalidateCache('server-members:');
    return result;
  }

  async getServerChannels(serverId) {
    return this.request(`/api/servers/${serverId}/channels`);
  }

  async getServerMembers(serverId) {
    return this.request(`/api/servers/${serverId}/members`, {
      cache: {
        key: `server-members:${serverId}`,
        ttl: 20_000
      }
    });
  }

  async createChannel(serverId, data) {
    const result = await this.request(`/api/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.invalidateCache(`server-members:${serverId}`);
    return result;
  }

  async updateChannel(serverId, channelId, data) {
    const result = await this.request(`/api/servers/${serverId}/channels/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    this.invalidateCache(`server-members:${serverId}`);
    return result;
  }

  async deleteChannel(serverId, channelId) {
    const result = await this.request(`/api/servers/${serverId}/channels/${channelId}`, {
      method: 'DELETE',
    });
    this.invalidateCache(`server-members:${serverId}`);
    return result;
  }

  // Инвайты
  async createInvite(serverId, data) {
    return this.request(`/api/servers/${serverId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getServerInvites(serverId) {
    return this.request(`/api/servers/${serverId}/invites`);
  }

  async joinServerByInvite(code) {
    const result = await this.request(`/api/servers/join/${code}`, {
      method: 'POST',
    });
    this.invalidateCache('server-members:');
    return result;
  }

  // Сообщения
  async getChannelMessages(channelId) {
    return this.request(`/api/messages/channels/${channelId}`);
  }

  async editMessage(messageId, content) {
    return this.request(`/api/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId) {
    return this.request(`/api/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  // Личные сообщения
  async sendDirectMessage(receiverId, content) {
    return this.request('/api/direct-messages/send', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content }),
    });
  }

  async getConversation(userId, page = 1, limit = 50) {
    return this.request(`/api/direct-messages/conversation/${userId}?page=${page}&limit=${limit}`);
  }

  async getConversations() {
    return this.request('/api/direct-messages/conversations');
  }

  async markMessagesAsRead(userId) {
    return this.request(`/api/direct-messages/read/${userId}`, {
      method: 'PUT',
    });
  }

  async editDirectMessage(messageId, content) {
    return this.request(`/api/direct-messages/edit/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteDirectMessage(messageId) {
    return this.request(`/api/direct-messages/delete/${messageId}`, {
      method: 'DELETE',
    });
  }

  // Блокировки пользователей
  async getBlockedUsers() {
    return this.request('/api/users/blocks');
  }

  async getBlockStatus(userId) {
    return this.request(`/api/users/blocks/status/${userId}`);
  }

  async blockUser(userId, reason) {
    return this.request(`/api/users/blocks/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async unblockUser(userId) {
    return this.request(`/api/users/blocks/${userId}`, {
      method: 'DELETE'
    });
  }

  // Баны сервера
  async getServerBans(serverId) {
    return this.request(`/api/servers/${serverId}/bans`, {
      cache: {
        key: `server-bans:${serverId}`,
        ttl: 10_000
      }
    });
  }

  async banServerMember(serverId, data) {
    const result = await this.request(`/api/servers/${serverId}/bans`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.invalidateCache(`server-members:${serverId}`);
    this.invalidateCache(`server-bans:${serverId}`);
    return result;
  }

  async unbanServerMember(serverId, userId) {
    const result = await this.request(`/api/servers/${serverId}/bans/${userId}`, {
      method: 'DELETE'
    });
    this.invalidateCache(`server-bans:${serverId}`);
    return result;
  }

  // Аутентификация
  async login(email, password) {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(username, password, email) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async logout() {
    return this.request('/api/auth/logout', {
      method: 'POST'
    });
  }

  async updateUser(userId, data) {
    return this.request(`/api/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserById(userId) {
    return this.request(`/api/auth/user/${userId}`, {
      cache: {
        key: `user:${userId}`,
        ttl: 30_000
      }
    });
  }

  async uploadAvatar(userId, formData) {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}/api/auth/users/${userId}/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Avatar upload failed');
    }

    return await response.json();
  }

  async uploadMessageFiles(formData) {
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}/api/messages/upload`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'File upload failed');
    }

    return await response.json();
  }

  // Друзья
  async getFriends() {
    return this.request('/api/friends');
  }

  async sendFriendRequest(username) {
    return this.request('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }

  async respondToFriendRequest(requestId, action) {
    return this.request('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ requestId, action })
    });
  }

  async removeFriend(friendId) {
    return this.request(`/api/friends/${friendId}`, {
      method: 'DELETE'
    });
  }
}

const apiService = new ApiService();
export default apiService;
