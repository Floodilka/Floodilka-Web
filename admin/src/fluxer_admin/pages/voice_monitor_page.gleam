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

import fluxer_admin/api/common
import fluxer_admin/api/gateway
import fluxer_admin/avatar
import fluxer_admin/components/flash
import fluxer_admin/components/layout
import fluxer_admin/components/ui
import fluxer_admin/web.{type Context, type Session, href}
import gleam/int
import gleam/list
import gleam/option
import gleam/string
import lustre/attribute as a
import lustre/element
import lustre/element/html as h
import wisp.{type Response}

pub fn view(
  ctx: Context,
  session: Session,
  current_admin: option.Option(common.UserLookupResult),
  flash_data: option.Option(flash.Flash),
) -> Response {
  let result = gateway.get_all_voice_states(ctx, session)

  let content = case result {
    Ok(data) -> render_voice_monitor(ctx, data)
    Error(common.Unauthorized) -> render_error("Not authorized")
    Error(common.Forbidden(message)) -> render_error(message)
    Error(common.NotFound) -> render_error("Not found")
    Error(common.ServerError) -> render_error("Server error")
    Error(common.NetworkError) -> render_error("Network error")
  }

  let html =
    layout.page_with_refresh(
      "Voice Monitor",
      "voice-monitor",
      ctx,
      session,
      current_admin,
      flash_data,
      content,
      True,
    )
  wisp.html_response(element.to_document_string(html), 200)
}

fn render_error(message: String) {
  ui.stack("6", [
    ui.heading_page("Voice Monitor"),
    h.div(
      [a.class("bg-red-50 border border-red-200 rounded-lg p-6 text-center")],
      [h.p([a.class("text-red-800")], [element.text(message)])],
    ),
  ])
}

fn render_voice_monitor(ctx: Context, data: gateway.AllVoiceStates) {
  let total_users =
    count_guild_users(data.guilds) + count_call_users(data.calls)
  let total_channels = count_guild_channels(data.guilds)
  let total_guilds = list.length(data.guilds)
  let total_calls = list.length(data.calls)

  h.div([], [
    ui.flex_row_between([
      ui.heading_page("Voice Monitor"),
      h.div([a.class("text-xs text-neutral-400")], [
        element.text("Auto-refresh every 3 sec"),
      ]),
    ]),
    h.div([a.class("space-y-6")], [
      render_stats_bar(total_users, total_channels, total_guilds, total_calls),
      ..list.flatten([
        list.map(data.guilds, fn(guild) {
          render_guild_voice(ctx, guild)
        }),
        case list.is_empty(data.calls) {
          True -> []
          False -> [render_calls_section(ctx, data.calls)]
        },
        case total_users == 0 {
          True -> [render_empty()]
          False -> []
        },
      ])
    ]),
  ])
}

fn render_stats_bar(
  total_users: Int,
  total_channels: Int,
  total_guilds: Int,
  total_calls: Int,
) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm p-6")],
    [
      h.div([a.class("grid grid-cols-2 md:grid-cols-4 gap-4")], [
        stat_item("Users in voice", int.to_string(total_users)),
        stat_item("Active channels", int.to_string(total_channels)),
        stat_item("Guilds with voice", int.to_string(total_guilds)),
        stat_item("Active calls", int.to_string(total_calls)),
      ]),
    ],
  )
}

fn stat_item(label: String, value: String) {
  h.div([a.class("text-center")], [
    h.div([a.class("text-2xl font-bold text-neutral-900")], [
      element.text(value),
    ]),
    h.div(
      [a.class("text-xs text-neutral-500 uppercase tracking-wider mt-1")],
      [element.text(label)],
    ),
  ])
}

fn render_guild_voice(ctx: Context, guild: gateway.GuildVoiceData) {
  let user_count = list.fold(guild.channels, 0, fn(acc, ch) {
    acc + list.length(ch.voice_states)
  })

  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm")],
    [
      h.div(
        [a.class("px-6 py-4 border-b border-neutral-200 flex items-center gap-3")],
        [
          case guild.guild_icon {
            option.Some(icon) ->
              h.img([
                a.src(
                  ctx.media_endpoint
                  <> "/icons/"
                  <> guild.guild_id
                  <> "/"
                  <> icon
                  <> ".webp?size=64",
                ),
                a.class("w-8 h-8 rounded-full"),
                a.alt(guild.guild_name),
              ])
            option.None ->
              h.div(
                [
                  a.class(
                    "w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-medium text-neutral-600",
                  ),
                ],
                [element.text(first_char(guild.guild_name))],
              )
          },
          h.div([], [
            h.a(
              [
                href(ctx, "/guilds/" <> guild.guild_id),
                a.class("text-sm font-semibold text-neutral-900 hover:text-blue-600"),
              ],
              [element.text(guild.guild_name)],
            ),
            h.div([a.class("text-xs text-neutral-500")], [
              element.text(
                int.to_string(user_count)
                <> " user(s) in "
                <> int.to_string(list.length(guild.channels))
                <> " channel(s)",
              ),
            ]),
          ]),
        ],
      ),
      h.div(
        [a.class("divide-y divide-neutral-100")],
        list.map(guild.channels, fn(channel) {
          render_channel(ctx, channel)
        }),
      ),
    ],
  )
}

fn render_channel(ctx: Context, channel: gateway.VoiceChannel) {
  h.div([a.class("px-6 py-3")], [
    h.div([a.class("flex items-center gap-2 mb-2")], [
      h.span([a.class("text-neutral-400")], [element.text("🔊")]),
      h.span([a.class("text-sm font-medium text-neutral-700")], [
        element.text(channel.channel_name),
      ]),
      h.span(
        [
          a.class(
            "text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full",
          ),
        ],
        [element.text(int.to_string(list.length(channel.voice_states)))],
      ),
    ]),
    h.div(
      [a.class("ml-6 space-y-1")],
      list.map(channel.voice_states, fn(vs) {
        render_voice_user(ctx, vs)
      }),
    ),
  ])
}

fn render_voice_user(ctx: Context, vs: gateway.VoiceStateEntry) {
  h.a(
    [
      href(ctx, "/users/" <> vs.user_id),
      a.class(
        "flex items-center gap-2 py-1.5 px-2 rounded hover:bg-neutral-50 transition-colors",
      ),
    ],
    [
      h.img([
        a.src(avatar.get_user_avatar_url(
          ctx.media_endpoint,
          ctx.cdn_endpoint,
          vs.user_id,
          vs.avatar,
          False,
          ctx.asset_version,
        )),
        a.alt(vs.username),
        a.class("w-6 h-6 rounded-full"),
      ]),
      h.span([a.class("text-sm text-neutral-900")], [
        element.text(case vs.display_name {
          option.Some(dn) -> dn
          option.None -> vs.username
        }),
      ]),
      h.span([a.class("text-xs text-neutral-400")], [
        element.text(vs.username),
      ]),
      h.div([a.class("ml-auto flex items-center gap-1")], [
        case vs.is_mobile {
          True ->
            status_badge("📱", "Mobile", "text-blue-500")
          False -> element.none()
        },
        case vs.mute || vs.self_mute {
          True ->
            status_badge("🔇", "Muted", "text-red-500")
          False -> element.none()
        },
        case vs.deaf || vs.self_deaf {
          True ->
            status_badge("🔈", "Deafened", "text-red-500")
          False -> element.none()
        },
        case vs.self_video {
          True ->
            status_badge("📹", "Camera", "text-green-500")
          False -> element.none()
        },
        case vs.self_stream {
          True ->
            status_badge("🖥", "Streaming", "text-purple-500")
          False -> element.none()
        },
      ]),
    ],
  )
}

fn render_calls_section(ctx: Context, calls: List(gateway.CallVoiceData)) {
  h.div(
    [a.class("bg-white border border-neutral-200 rounded-lg shadow-sm")],
    [
      h.div([a.class("px-6 py-4 border-b border-neutral-200")], [
        h.div([a.class("text-sm font-semibold text-neutral-900")], [
          element.text(
            "Active calls (" <> int.to_string(list.length(calls)) <> ")",
          ),
        ]),
      ]),
      h.div(
        [a.class("divide-y divide-neutral-100")],
        list.map(calls, fn(call) {
          render_call(ctx, call)
        }),
      ),
    ],
  )
}

fn render_call(ctx: Context, call: gateway.CallVoiceData) {
  h.div([a.class("px-6 py-3")], [
    h.div([a.class("flex items-center gap-2 mb-2")], [
      h.span([a.class("text-neutral-400")], [element.text("📞")]),
      h.span([a.class("text-sm font-medium text-neutral-700")], [
        element.text("Call " <> call.channel_id),
      ]),
      h.span(
        [
          a.class(
            "text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full",
          ),
        ],
        [element.text(int.to_string(list.length(call.voice_states)))],
      ),
    ]),
    h.div(
      [a.class("ml-6 space-y-1")],
      list.map(call.voice_states, fn(vs) { render_voice_user(ctx, vs) }),
    ),
  ])
}

fn render_empty() {
  h.div(
    [
      a.class(
        "bg-white border border-neutral-200 rounded-lg shadow-sm p-12 text-center",
      ),
    ],
    [
      h.div([a.class("text-4xl mb-3")], [element.text("🔇")]),
      h.div([a.class("text-neutral-500")], [
        element.text("No active voice channels or calls"),
      ]),
    ],
  )
}

fn status_badge(icon: String, title: String, color: String) {
  h.span(
    [a.class("text-xs " <> color), a.attribute("title", title)],
    [element.text(icon)],
  )
}

fn first_char(s: String) -> String {
  case string.first(s) {
    Ok(ch) -> ch
    Error(_) -> "?"
  }
}

fn count_guild_users(guilds: List(gateway.GuildVoiceData)) -> Int {
  list.fold(guilds, 0, fn(acc, guild) {
    acc
    + list.fold(guild.channels, 0, fn(acc2, ch) {
        acc2 + list.length(ch.voice_states)
      })
  })
}

fn count_call_users(calls: List(gateway.CallVoiceData)) -> Int {
  list.fold(calls, 0, fn(acc, call) {
    acc + list.length(call.voice_states)
  })
}

fn count_guild_channels(guilds: List(gateway.GuildVoiceData)) -> Int {
  list.fold(guilds, 0, fn(acc, guild) {
    acc + list.length(guild.channels)
  })
}
