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

-module(gateway_rpc_voice).

-export([execute_method/2]).

-spec execute_method(binary(), map()) -> term().
execute_method(<<"voice.confirm_connection">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    ConnectionId = maps:get(<<"connection_id">>, Params),
    case parse_optional_guild_id(Params) of
        undefined ->
            gateway_rpc_call:execute_method(
                <<"call.confirm_connection">>,
                #{
                    <<"channel_id">> => ChannelIdBin,
                    <<"connection_id">> => ConnectionId
                }
            );
        GuildId ->
            TokenNonce = maps:get(<<"token_nonce">>, Params, undefined),
            gateway_rpc_guild:execute_method(
                <<"guild.confirm_voice_connection_from_livekit">>,
                #{
                    <<"guild_id">> => integer_to_binary(GuildId),
                    <<"connection_id">> => ConnectionId,
                    <<"token_nonce">> => TokenNonce
                }
            )
    end;
execute_method(<<"voice.disconnect_user_if_in_channel">>, Params) ->
    ChannelIdBin = maps:get(<<"channel_id">>, Params),
    UserIdBin = maps:get(<<"user_id">>, Params),
    ConnectionId = maps:get(<<"connection_id">>, Params, undefined),
    case parse_optional_guild_id(Params) of
        undefined ->
            CallParams = #{
                <<"channel_id">> => ChannelIdBin,
                <<"user_id">> => UserIdBin
            },
            gateway_rpc_call:execute_method(
                <<"call.disconnect_user_if_in_channel">>,
                maybe_put_connection_id(ConnectionId, CallParams)
            );
        GuildId ->
            GuildParams = #{
                <<"guild_id">> => integer_to_binary(GuildId),
                <<"user_id">> => UserIdBin,
                <<"expected_channel_id">> => ChannelIdBin
            },
            gateway_rpc_guild:execute_method(
                <<"guild.disconnect_voice_user_if_in_channel">>,
                maybe_put_connection_id(ConnectionId, GuildParams)
            )
    end;
execute_method(Method, _Params) ->
    throw({error, <<"Unknown method: ", Method/binary>>}).

-spec parse_optional_guild_id(map()) -> integer() | undefined.
parse_optional_guild_id(Params) ->
    case maps:get(<<"guild_id">>, Params, undefined) of
        undefined ->
            undefined;
        null ->
            undefined;
        GuildIdBin ->
            validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin)
    end.

-spec maybe_put_connection_id(binary() | undefined, map()) -> map().
maybe_put_connection_id(undefined, Params) ->
    Params;
maybe_put_connection_id(ConnectionId, Params) ->
    Params#{<<"connection_id">> => ConnectionId}.
