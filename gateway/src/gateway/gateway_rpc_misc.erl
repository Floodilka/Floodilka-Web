%% Copyright (C) 2026 Floodilka Contributors
%%
%% This file is part of Floodilka.
%%
%% Floodilka is free software: you can redistribute it and/or modify
%% it under the terms of the GNU Affero General Public License as published by
%% the Free Software Foundation, either version 3 of the License, or
%% (at your option) any later version.
%%
%% Floodilka is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY; without even the implied warranty of
%% MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
%% GNU Affero General Public License for more details.
%%
%% You should have received a copy of the GNU Affero General Public License
%% along with Floodilka. If not, see <https://www.gnu.org/licenses/>.

-module(gateway_rpc_misc).

-export([execute_method/2, get_local_node_stats/0]).

execute_method(<<"process.memory_stats">>, Params) ->
    Limit =
        case maps:get(<<"limit">>, Params, undefined) of
            undefined ->
                100;
            LimitValue ->
                validation:snowflake_or_throw(<<"limit">>, LimitValue)
        end,

    Guilds = process_memory_stats:get_guild_memory_stats(Limit),
    #{<<"guilds">> => Guilds};
execute_method(<<"process.node_stats">>, _Params) ->
    get_local_node_stats();
execute_method(<<"process.get_all_voice_states">>, _Params) ->
    GuildVoiceStates = collect_all_guild_voice_states(),

    CallVoiceStates =
        case catch gen_server:call(call_manager, get_all_call_states, 5000) of
            {ok, CallResults} -> CallResults;
            _ -> []
        end,

    FormattedGuilds = lists:map(fun format_guild_voice_data/1, GuildVoiceStates),
    FormattedCalls = lists:map(fun format_call_voice_data/1, CallVoiceStates),

    #{
        <<"guilds">> => FormattedGuilds,
        <<"calls">> => FormattedCalls
    }.

get_local_node_stats() ->
    SessionCount =
        case gen_server:call(session_manager, get_global_count, 1000) of
            {ok, SC} -> SC;
            _ -> 0
        end,

    GuildCount =
        case gen_server:call(guild_manager, get_global_count, 1000) of
            {ok, GC} -> GC;
            _ -> 0
        end,

    PresenceCount =
        case gen_server:call(presence_manager, get_global_count, 1000) of
            {ok, PC} -> PC;
            _ -> 0
        end,

    CallCount =
        case gen_server:call(call_manager, get_global_count, 1000) of
            {ok, CC} -> CC;
            _ -> 0
        end,

    MemoryInfo = erlang:memory(),
    TotalMemory = proplists:get_value(total, MemoryInfo, 0),
    ProcessMemory = proplists:get_value(processes, MemoryInfo, 0),
    SystemMemory = proplists:get_value(system, MemoryInfo, 0),

    #{
        <<"status">> => <<"healthy">>,
        <<"sessions">> => SessionCount,
        <<"guilds">> => GuildCount,
        <<"presences">> => PresenceCount,
        <<"calls">> => CallCount,
        <<"memory">> => #{
            <<"total">> => TotalMemory,
            <<"processes">> => ProcessMemory,
            <<"system">> => SystemMemory
        },
        <<"process_count">> => erlang:system_info(process_count),
        <<"process_limit">> => erlang:system_info(process_limit),
        <<"uptime_seconds">> => element(1, erlang:statistics(wall_clock)) div 1000
    }.

collect_all_guild_voice_states() ->
    ShardPids = get_shard_pids(),
    Parent = self(),
    Refs = lists:map(
        fun(Pid) ->
            Ref = make_ref(),
            spawn(fun() ->
                Result = case catch gen_server:call(Pid, get_all_voice_states, 10000) of
                    {ok, R} -> R;
                    _ -> []
                end,
                Parent ! {voice_states_result, Ref, Result}
            end),
            Ref
        end,
        ShardPids
    ),
    lists:flatmap(
        fun(Ref) ->
            receive
                {voice_states_result, Ref, Result} -> Result
            after 12000 ->
                []
            end
        end,
        Refs
    ).

get_shard_pids() ->
    try
        case ets:lookup(guild_manager_shard_table, shard_count) of
            [{shard_count, Count}] when is_integer(Count), Count > 0 ->
                lists:filtermap(
                    fun(Index) ->
                        case ets:lookup(guild_manager_shard_table, {shard_pid, Index}) of
                            [{{shard_pid, Index}, Pid}] when is_pid(Pid) ->
                                case erlang:is_process_alive(Pid) of
                                    true -> {true, Pid};
                                    false -> false
                                end;
                            _ -> false
                        end
                    end,
                    lists:seq(0, Count - 1)
                );
            _ -> []
        end
    catch
        error:badarg -> []
    end.

format_guild_voice_data(GuildData) ->
    #{
        guild_id := GuildId,
        guild_name := GuildName,
        guild_icon := GuildIcon,
        channels := Channels,
        voice_states := VoiceStates
    } = GuildData,

    ChannelMap = build_channel_name_map(Channels),

    GroupedByChannel = lists:foldl(
        fun(VS, Acc) ->
            ChannelIdBin = maps:get(<<"channel_id">>, VS, null),
            Existing = maps:get(ChannelIdBin, Acc, []),
            maps:put(ChannelIdBin, [format_voice_state(VS) | Existing], Acc)
        end,
        #{},
        VoiceStates
    ),

    ChannelList = maps:fold(
        fun(ChannelIdBin, States, Acc) ->
            ChannelName = maps:get(ChannelIdBin, ChannelMap, ChannelIdBin),
            [#{
                <<"channel_id">> => ChannelIdBin,
                <<"channel_name">> => ChannelName,
                <<"voice_states">> => States
            } | Acc]
        end,
        [],
        GroupedByChannel
    ),

    #{
        <<"guild_id">> => GuildId,
        <<"guild_name">> => GuildName,
        <<"guild_icon">> => GuildIcon,
        <<"channels">> => ChannelList
    }.

format_call_voice_data(CallData) ->
    #{
        channel_id := ChannelId,
        voice_states := VoiceStates
    } = CallData,
    #{
        <<"channel_id">> => ChannelId,
        <<"voice_states">> => lists:map(fun format_voice_state/1, VoiceStates)
    }.

build_channel_name_map(Channels) when is_list(Channels) ->
    lists:foldl(
        fun(Channel, Acc) when is_map(Channel) ->
            Id = type_conv:to_binary(maps:get(<<"id">>, Channel, <<>>)),
            Name = maps:get(<<"name">>, Channel, Id),
            maps:put(Id, Name, Acc);
           (_, Acc) -> Acc
        end,
        #{},
        Channels
    );
build_channel_name_map(_) ->
    #{}.

format_voice_state(VoiceState) ->
    #{
        <<"user_id">> => to_bin(maps:get(<<"user_id">>, VoiceState, <<>>)),
        <<"channel_id">> => to_bin(maps:get(<<"channel_id">>, VoiceState, <<>>)),
        <<"guild_id">> => to_bin(maps:get(<<"guild_id">>, VoiceState, <<>>)),
        <<"connection_id">> => maps:get(<<"connection_id">>, VoiceState, <<>>),
        <<"self_mute">> => maps:get(<<"self_mute">>, VoiceState, false),
        <<"self_deaf">> => maps:get(<<"self_deaf">>, VoiceState, false),
        <<"self_video">> => maps:get(<<"self_video">>, VoiceState, false),
        <<"self_stream">> => maps:get(<<"self_stream">>, VoiceState, false),
        <<"mute">> => maps:get(<<"mute">>, VoiceState, false),
        <<"deaf">> => maps:get(<<"deaf">>, VoiceState, false),
        <<"is_mobile">> => maps:get(<<"is_mobile">>, VoiceState, false)
    }.

to_bin(V) when is_integer(V) -> integer_to_binary(V);
to_bin(V) when is_binary(V) -> V;
to_bin(_) -> <<>>.
