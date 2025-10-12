import { BACKEND_URL } from '../constants';

class ApiService {
  constructor() {
    this.baseURL = BACKEND_URL;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Серверы
  async getServers() {
    return this.request('/api/servers');
  }

  async createServer(data) {
    return this.request('/api/servers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getServerChannels(serverId) {
    return this.request(`/api/servers/${serverId}/channels`);
  }

  async getServerMembers(serverId) {
    return this.request(`/api/servers/${serverId}/members`);
  }

  async createChannel(serverId, data) {
    return this.request(`/api/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChannel(serverId, channelId, data) {
    return this.request(`/api/servers/${serverId}/channels/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(serverId, channelId) {
    return this.request(`/api/servers/${serverId}/channels/${channelId}`, {
      method: 'DELETE',
    });
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
    return this.request(`/api/servers/join/${code}`, {
      method: 'POST',
    });
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

  async updateUser(userId, data) {
    return this.request(`/api/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(userId, formData) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/api/auth/users/${userId}/avatar`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Avatar upload failed');
    }

    return await response.json();
  }

  async uploadMessageFiles(formData) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/api/messages/upload`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'File upload failed');
    }

    return await response.json();
  }
}

export default new ApiService();

