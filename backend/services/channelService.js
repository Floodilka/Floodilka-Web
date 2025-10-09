const Channel = require('../models/Channel');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { validateChannelData } = require('../validators/channelValidator');
const { CHANNEL_TYPES } = require('../constants');

class ChannelService {
  async getServerChannels(serverId) {
    const channels = await Channel.find({ serverId }).sort({ createdAt: 1 });
    return channels;
  }

  async getChannelById(channelId) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Канал не найден');
    }
    return channel;
  }

  async createChannel(serverId, userId, channelData) {
    const validated = validateChannelData(channelData);

    const newChannel = new Channel({
      name: validated.name,
      type: validated.type,
      serverId: serverId,
      createdBy: userId
    });

    await newChannel.save();
    return newChannel;
  }

  async updateChannel(serverId, channelId, updateData) {
    const { name, topic, slowMode, nsfw, hideAfterInactivity } = updateData;

    if (!name || name.trim() === '') {
      throw new ValidationError('Название канала обязательно');
    }

    const channel = await this.getChannelById(channelId);

    // Проверить, что канал принадлежит этому серверу
    if (channel.serverId.toString() !== serverId) {
      throw new ValidationError('Канал не принадлежит этому серверу');
    }

    // Обновить поля канала
    channel.name = name.trim();
    if (topic !== undefined) channel.topic = topic.trim();
    if (slowMode !== undefined) channel.slowMode = slowMode;
    if (nsfw !== undefined) channel.nsfw = nsfw;
    if (hideAfterInactivity !== undefined) channel.hideAfterInactivity = hideAfterInactivity;

    await channel.save();
    return channel;
  }

  async deleteChannel(serverId, channelId) {
    const channel = await this.getChannelById(channelId);

    // Проверить, что канал принадлежит этому серверу
    if (channel.serverId.toString() !== serverId) {
      throw new ValidationError('Канал не принадлежит этому серверу');
    }

    await Channel.findByIdAndDelete(channelId);
    return { message: 'Канал успешно удален' };
  }
}

module.exports = new ChannelService();

