-module(voice_pending_common_test).
-include_lib("eunit/include/eunit.hrl").

%%--------------------------------------------------------------------
%% Tests for voice_pending_common — the pure data module used by
%% call.erl to track pending LiveKit connections.
%%--------------------------------------------------------------------

add_and_get_test() ->
    Map0 = #{},
    Meta = #{user_id => 1, session_id => <<"s1">>, channel_id => 100},
    Map1 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta, Map0),
    Result = voice_pending_common:get_pending_connection(<<"conn1">>, Map1),
    ?assertMatch(#{user_id := 1, session_id := <<"s1">>}, Result),
    %% joined_at timestamp is added automatically
    ?assert(maps:is_key(joined_at, Result)).

get_undefined_connection_test() ->
    Map = #{},
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"nope">>, Map)).

get_with_undefined_id_test() ->
    Map = #{<<"conn1">> => #{user_id => 1}},
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(undefined, Map)).

remove_test() ->
    Meta = #{user_id => 1},
    Map0 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta, #{}),
    Map1 = voice_pending_common:remove_pending_connection(<<"conn1">>, Map0),
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"conn1">>, Map1)).

remove_undefined_test() ->
    Map = #{<<"conn1">> => #{user_id => 1}},
    ?assertEqual(Map, voice_pending_common:remove_pending_connection(undefined, Map)).

remove_nonexistent_test() ->
    Map = #{<<"conn1">> => #{user_id => 1}},
    Map2 = voice_pending_common:remove_pending_connection(<<"conn2">>, Map),
    ?assertEqual(1, maps:size(Map2)).

confirm_existing_test() ->
    Meta = #{user_id => 1},
    Map0 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta, #{}),
    {confirmed, Map1} = voice_pending_common:confirm_pending_connection(<<"conn1">>, Map0),
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"conn1">>, Map1)).

confirm_nonexistent_test() ->
    {not_found, _} = voice_pending_common:confirm_pending_connection(<<"nope">>, #{}).

confirm_undefined_test() ->
    {not_found, _} = voice_pending_common:confirm_pending_connection(undefined, #{}).

%% -------------------------------------------------------------------
%% Scenario tests: simulate the grace timeout decision logic
%% (extracted from call.erl handle_info clauses)
%% -------------------------------------------------------------------

%% Simulates: confirm arrives during grace period → pending gone → no disconnect
grace_timeout_after_confirm_test() ->
    Meta = #{user_id => 42, session_id => <<"s1">>, channel_id => 100},
    Map0 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta, #{}),
    %% LiveKit confirms during grace period
    {confirmed, Map1} = voice_pending_common:confirm_pending_connection(<<"conn1">>, Map0),
    %% Grace timeout fires — pending is gone
    Result = voice_pending_common:get_pending_connection(<<"conn1">>, Map1),
    ?assertEqual(undefined, Result).
    %% call.erl would return {noreply, State} — no disconnect. Correct!

%% Simulates: no confirm during grace → pending still there → should disconnect
grace_timeout_phantom_test() ->
    Meta = #{user_id => 42, session_id => <<"s1">>, channel_id => 100},
    Map0 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta, #{}),
    %% No confirm arrives — grace timeout fires
    Result = voice_pending_common:get_pending_connection(<<"conn1">>, Map0),
    ?assertMatch(#{user_id := 42}, Result).
    %% call.erl would check session and disconnect. Correct!

%% Simulates: user reconnects with new connection during grace period.
%% Old pending should NOT cause disconnect of new connection.
grace_timeout_after_reconnect_test() ->
    Meta1 = #{user_id => 42, session_id => <<"s1">>, channel_id => 100},
    Meta2 = #{user_id => 42, session_id => <<"s2">>, channel_id => 100},
    Map0 = voice_pending_common:add_pending_connection(<<"conn1">>, Meta1, #{}),
    %% User reconnects with new connection
    Map1 = voice_pending_common:add_pending_connection(<<"conn2">>, Meta2, Map0),
    %% New connection confirmed
    {confirmed, Map2} = voice_pending_common:confirm_pending_connection(<<"conn2">>, Map1),
    %% Grace timeout fires for OLD conn1 — it's still in the map
    OldPending = voice_pending_common:get_pending_connection(<<"conn1">>, Map2),
    ?assertMatch(#{session_id := <<"s1">>}, OldPending),
    %% call.erl would see session_id <<"s1">> no longer matches current session <<"s2">>
    %% → just clean up stale pending, DON'T disconnect. Correct!

    %% Simulate the cleanup
    Map3 = voice_pending_common:remove_pending_connection(<<"conn1">>, Map2),
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"conn1">>, Map3)),
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"conn2">>, Map3)).

%% Multiple connections from different users don't interfere
multiple_users_independent_test() ->
    MetaA = #{user_id => 1, session_id => <<"sa">>},
    MetaB = #{user_id => 2, session_id => <<"sb">>},
    Map0 = voice_pending_common:add_pending_connection(<<"connA">>, MetaA, #{}),
    Map1 = voice_pending_common:add_pending_connection(<<"connB">>, MetaB, Map0),
    %% Confirm only A
    {confirmed, Map2} = voice_pending_common:confirm_pending_connection(<<"connA">>, Map1),
    ?assertEqual(undefined, voice_pending_common:get_pending_connection(<<"connA">>, Map2)),
    ?assertMatch(#{user_id := 2}, voice_pending_common:get_pending_connection(<<"connB">>, Map2)).
