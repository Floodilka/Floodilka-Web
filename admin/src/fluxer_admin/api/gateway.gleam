//// Copyright (C) 2026 Fluxer Contributors
////
//// This file is part of Fluxer.
////
//// Fluxer is free software: you can redistribute it and/or modify
//// it under the terms of the GNU Affero General Public License as published by
//// the Free Software Foundation, either version 3 of the License, or
//// (at your option) any later version.
////
//// Fluxer is distributed in the hope that it will be useful,
//// but WITHOUT ANY WARRANTY; without even the implied warranty of
//// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
//// GNU Affero General Public License for more details.
////
//// You should have received a copy of the GNU Affero General Public License
//// along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

import fluxer_admin/api/common.{
  type ApiError, Forbidden, NetworkError, NotFound, ServerError, Unauthorized,
}
import fluxer_admin/web.{type Context, type Session}
import gleam/dict.{type Dict}
import gleam/dynamic/decode
import gleam/http
import gleam/http/request
import gleam/httpc
import gleam/json
import gleam/list
import gleam/option

pub type VoiceStateEntry {
  VoiceStateEntry(
    user_id: String,
    connection_id: String,
    username: String,
    display_name: option.Option(String),
    avatar: option.Option(String),
    self_mute: Bool,
    self_deaf: Bool,
    self_video: Bool,
    self_stream: Bool,
    mute: Bool,
    deaf: Bool,
    is_mobile: Bool,
  )
}

pub type VoiceChannel {
  VoiceChannel(
    channel_id: String,
    channel_name: String,
    voice_states: List(VoiceStateEntry),
  )
}

pub type GuildVoiceData {
  GuildVoiceData(
    guild_id: String,
    guild_name: String,
    guild_icon: option.Option(String),
    channels: List(VoiceChannel),
  )
}

pub type CallVoiceData {
  CallVoiceData(
    channel_id: String,
    voice_states: List(VoiceStateEntry),
  )
}

pub type UserInfo {
  UserInfo(
    username: String,
    display_name: option.Option(String),
    avatar: option.Option(String),
  )
}

pub type AllVoiceStates {
  AllVoiceStates(
    guilds: List(GuildVoiceData),
    calls: List(CallVoiceData),
  )
}

pub fn get_all_voice_states(
  ctx: Context,
  session: Session,
) -> Result(AllVoiceStates, ApiError) {
  let url = ctx.api_endpoint <> "/admin/gateway/voice-states"

  let assert Ok(req) = request.to(url)
  let req =
    req
    |> request.set_method(http.Get)
    |> request.set_header("authorization", "Bearer " <> session.access_token)

  case httpc.send(req) {
    Ok(resp) if resp.status == 200 -> {
      let user_info_decoder = {
        use username <- decode.field("username", decode.string)
        use display_name <- decode.field(
          "display_name",
          decode.optional(decode.string),
        )
        use avatar_val <- decode.field(
          "avatar",
          decode.optional(decode.string),
        )
        decode.success(UserInfo(
          username: username,
          display_name: display_name,
          avatar: avatar_val,
        ))
      }

      let voice_state_decoder = {
        use user_id <- decode.field("user_id", decode.string)
        use connection_id <- decode.optional_field(
          "connection_id",
          "",
          decode.string,
        )
        use self_mute <- decode.optional_field("self_mute", False, decode.bool)
        use self_deaf <- decode.optional_field("self_deaf", False, decode.bool)
        use self_video <- decode.optional_field(
          "self_video",
          False,
          decode.bool,
        )
        use self_stream <- decode.optional_field(
          "self_stream",
          False,
          decode.bool,
        )
        use mute <- decode.optional_field("mute", False, decode.bool)
        use deaf <- decode.optional_field("deaf", False, decode.bool)
        use is_mobile <- decode.optional_field(
          "is_mobile",
          False,
          decode.bool,
        )
        decode.success(#(
          user_id,
          connection_id,
          self_mute,
          self_deaf,
          self_video,
          self_stream,
          mute,
          deaf,
          is_mobile,
        ))
      }

      let channel_decoder = {
        use channel_id <- decode.field("channel_id", decode.string)
        use channel_name <- decode.field("channel_name", decode.string)
        use voice_states <- decode.field(
          "voice_states",
          decode.list(voice_state_decoder),
        )
        decode.success(#(channel_id, channel_name, voice_states))
      }

      let guild_decoder = {
        use guild_id <- decode.field("guild_id", decode.string)
        use guild_name <- decode.field("guild_name", decode.string)
        use guild_icon <- decode.field(
          "guild_icon",
          decode.optional(decode.string),
        )
        use channels <- decode.field("channels", decode.list(channel_decoder))
        decode.success(#(guild_id, guild_name, guild_icon, channels))
      }

      let call_decoder = {
        use channel_id <- decode.field("channel_id", decode.string)
        use voice_states <- decode.field(
          "voice_states",
          decode.list(voice_state_decoder),
        )
        decode.success(#(channel_id, voice_states))
      }

      let decoder = {
        use guilds <- decode.field("guilds", decode.list(guild_decoder))
        use calls <- decode.field("calls", decode.list(call_decoder))
        use users <- decode.field(
          "users",
          decode.dict(decode.string, user_info_decoder),
        )
        decode.success(#(guilds, calls, users))
      }

      case json.parse(resp.body, decoder) {
        Ok(#(guilds_raw, calls_raw, users)) -> {
          let guilds =
            list.map(guilds_raw, fn(g) {
              let #(guild_id, guild_name, guild_icon, channels_raw) = g
              let channels =
                list.map(channels_raw, fn(ch) {
                  let #(channel_id, channel_name, vs_raw) = ch
                  let voice_states =
                    list.map(vs_raw, fn(vs) {
                      enrich_voice_state(vs, users)
                    })
                  VoiceChannel(
                    channel_id: channel_id,
                    channel_name: channel_name,
                    voice_states: voice_states,
                  )
                })
              GuildVoiceData(
                guild_id: guild_id,
                guild_name: guild_name,
                guild_icon: guild_icon,
                channels: channels,
              )
            })

          let calls =
            list.map(calls_raw, fn(c) {
              let #(channel_id, vs_raw) = c
              let voice_states =
                list.map(vs_raw, fn(vs) { enrich_voice_state(vs, users) })
              CallVoiceData(
                channel_id: channel_id,
                voice_states: voice_states,
              )
            })

          Ok(AllVoiceStates(guilds: guilds, calls: calls))
        }
        Error(_) -> Error(ServerError)
      }
    }
    Ok(resp) if resp.status == 401 -> Error(Unauthorized)
    Ok(resp) if resp.status == 403 -> {
      let message_decoder = {
        use message <- decode.field("message", decode.string)
        decode.success(message)
      }

      let message = case json.parse(resp.body, message_decoder) {
        Ok(msg) -> msg
        Error(_) ->
          "Missing required permissions. Contact an administrator to request access."
      }

      Error(Forbidden(message))
    }
    Ok(resp) if resp.status == 404 -> Error(NotFound)
    Ok(_resp) -> Error(ServerError)
    Error(_) -> Error(NetworkError)
  }
}

fn enrich_voice_state(
  vs: #(String, String, Bool, Bool, Bool, Bool, Bool, Bool, Bool),
  users: Dict(String, UserInfo),
) -> VoiceStateEntry {
  let #(
    user_id,
    connection_id,
    self_mute,
    self_deaf,
    self_video,
    self_stream,
    mute,
    deaf,
    is_mobile,
  ) = vs

  let user_info = dict.get(users, user_id)

  let username = case user_info {
    Ok(u) -> u.username
    Error(_) -> user_id
  }

  let display_name = case user_info {
    Ok(u) -> u.display_name
    Error(_) -> option.None
  }

  let avatar_val = case user_info {
    Ok(u) -> u.avatar
    Error(_) -> option.None
  }

  VoiceStateEntry(
    user_id: user_id,
    connection_id: connection_id,
    username: username,
    display_name: display_name,
    avatar: avatar_val,
    self_mute: self_mute,
    self_deaf: self_deaf,
    self_video: self_video,
    self_stream: self_stream,
    mute: mute,
    deaf: deaf,
    is_mobile: is_mobile,
  )
}
