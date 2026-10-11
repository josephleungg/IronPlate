#!/usr/bin/env bash
# End-to-end API smoke test against a running dev server. Usage: scripts/smoke.sh [base-url]
set -u
BASE=${1:-http://localhost:3000}
A=$(mktemp); B=$(mktemp)
SUF=$RANDOM$RANDOM
pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  ok   $1"; }
bad()  { fail=$((fail+1)); echo "  FAIL $1 :: $2"; }
req()  { local jar=$1 method=$2 path=$3 data=${4:-}; if [ -n "$data" ]; then curl -s -b "$jar" -c "$jar" -H 'content-type: application/json' -H "origin: $BASE" -X "$method" "$BASE$path" -d "$data" -w '\n%{http_code}'; else curl -s -b "$jar" -c "$jar" -H "origin: $BASE" -X "$method" "$BASE$path" -w '\n%{http_code}'; fi; }
body() { sed '$d'; }
code() { tail -n1; }
expect() { # name expected_code response
  local c; c=$(echo "$3" | code); if [ "$c" = "$2" ]; then ok "$1"; else bad "$1" "expected $2 got $c: $(echo "$3" | body | head -c 300)"; fi; }
jq_() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log($1)}catch(e){console.log('')}})"; }

echo "# auth"
R=$(req $A POST /api/auth/sign-up/email "{\"email\":\"ann$SUF@test.dev\",\"password\":\"password123\",\"name\":\"Ann Lifter\",\"username\":\"ann$SUF\"}"); expect "sign up ann" 200 "$R"
R=$(req $B POST /api/auth/sign-up/email "{\"email\":\"bo$SUF@test.dev\",\"password\":\"password123\",\"name\":\"Bo Runner\",\"username\":\"bo$SUF\"}"); expect "sign up bo" 200 "$R"
R=$(req /dev/null GET /api/v1/me); expect "unauthenticated is 401" 401 "$R"
R=$(req $A GET /api/v1/me); expect "get me" 200 "$R"; echo "$R" | body | jq_ 'j.onboarded===false?"":"x"' >/dev/null
[ "$(echo "$R" | body | jq_ 'j.onboarded')" = "false" ] && ok "new user not onboarded" || bad "onboarded flag" "$(echo "$R" | body | head -c 200)"

echo "# onboarding"
R=$(req $A POST /api/v1/me/onboarding '{"sex":"male","birthDate":"1995-05-05","heightCm":180,"weightKg":80,"activityLevel":"moderate","goal":"lose","weeklyRateKg":0.5,"timezone":"America/Toronto"}'); expect "onboard ann" 200 "$R"
CAL=$(echo "$R" | body | jq_ 'j.recommendation.calories'); [ "$CAL" -gt 1500 ] && [ "$CAL" -lt 3500 ] && ok "calories sane ($CAL)" || bad "calories" "$CAL"
R=$(req $B POST /api/v1/me/onboarding '{"sex":"female","birthDate":"1998-01-01","heightCm":165,"weightKg":60,"activityLevel":"light","goal":"maintain","timezone":"UTC"}'); expect "onboard bo" 200 "$R"
R=$(req $A POST /api/v1/me/onboarding '{"sex":"male"}'); expect "validation error is 400" 400 "$R"
R=$(req $A GET /api/v1/me/settings); [ "$(echo "$R" | body | jq_ 'j.liftUnit')" = "null" ] && ok "lifting unit starts unset (follows main units)" || bad "default liftUnit" "$(echo "$R" | body | head -c 200)"
R=$(req $A PATCH /api/v1/me/settings '{"liftUnit":"lb"}'); expect "set lifting unit to lb" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.liftUnit')" = "lb" ] && [ "$(echo "$R" | body | jq_ 'j.weightUnit')" = "kg" ] && ok "lifts in lb while body weight stays kg" || bad "independent units" "$(echo "$R" | body | head -c 250)"
R=$(req $A PATCH /api/v1/me/settings '{"liftUnit":"stone"}'); expect "invalid lifting unit is 400" 400 "$R"
R=$(req $A PATCH /api/v1/me/settings '{"liftUnit":null}'); expect "clear lifting unit" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.liftUnit')" = "null" ] && ok "lifting unit back to following main units" || bad "clear liftUnit" "$(echo "$R" | body | head -c 200)"

echo "# foods & diary"
R=$(req $A GET "/api/v1/foods/search?q=chicken+breast"); expect "search foods" 200 "$R"
FOOD=$(echo "$R" | body | jq_ 'j.data[0].id'); FN=$(echo "$R" | body | jq_ 'j.data[0].name'); SERV=$(echo "$R" | body | jq_ 'j.data[0].servings[0].id')
[ -n "$FOOD" ] && ok "found '$FN'" || bad "search result" "empty"
R=$(req $A GET /api/v1/meal-slots); expect "meal slots" 200 "$R"
SLOT=$(echo "$R" | body | jq_ 'j.data[0].id'); [ "$(echo "$R" | body | jq_ 'j.data.length')" = "4" ] && ok "4 default meal slots" || bad "slots" "$(echo "$R" | body | head -c 200)"
TODAY=$(date +%Y-%m-%d)
R=$(req $A POST /api/v1/diary/$TODAY/entries "{\"mealSlotId\":\"$SLOT\",\"foodId\":\"$FOOD\",\"servingId\":\"$SERV\",\"servings\":2}"); expect "log food" 201 "$R"
EID=$(echo "$R" | body | jq_ 'j.id'); KC=$(echo "$R" | body | jq_ 'j.kcal'); echo "       2 servings -> $KC kcal"
R=$(req $A POST /api/v1/diary/$TODAY/entries "{\"id\":\"$EID\",\"mealSlotId\":\"$SLOT\",\"foodId\":\"$FOOD\",\"servingId\":\"$SERV\",\"servings\":2}"); expect "retry with same id is idempotent" 201 "$R"
R=$(req $A GET /api/v1/diary/$TODAY); expect "get diary day" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.meals.reduce((a,m)=>a+m.entries.length,0)')" = "1" ] && ok "still exactly 1 entry after retry" || bad "dedupe" "$(echo "$R" | body | head -c 300)"
[ "$(echo "$R" | body | jq_ 'j.totals.kcal')" = "$KC" ] && ok "day total equals entry kcal" || bad "totals" ""
R=$(req $A PATCH /api/v1/diary/entries/$EID '{"servings":1}'); expect "edit servings" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.kcal*2')" = "$KC" ] && ok "kcal rescaled when servings halved" || bad "rescale" "$(echo "$R" | body | head -c 200)"
R=$(req $A POST /api/v1/diary/$TODAY/quick-add "{\"mealSlotId\":\"$SLOT\",\"kcal\":300,\"proteinG\":10}"); expect "quick add" 201 "$R"
R=$(req $A POST /api/v1/diary/$TODAY/water '{"amountMl":500}'); expect "log water" 201 "$R"
R=$(req $B GET /api/v1/diary/$TODAY); expect "bo sees own empty diary" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.totals.kcal')" = "0" ] && ok "diaries are isolated per user" || bad "isolation" ""
R=$(req $B PATCH /api/v1/diary/entries/$EID '{"servings":9}'); expect "bo cannot edit ann's entry" 404 "$R"
R=$(req $A POST /api/v1/diary/$TODAY/copy "{\"fromDate\":\"$TODAY\",\"fromMealSlotId\":\"$SLOT\",\"toMealSlotId\":\"$(req $A GET /api/v1/meal-slots | body | jq_ 'j.data[1].id')\"}"); expect "copy meal to another slot" 200 "$R"
R=$(req $A POST /api/v1/diary/2026-02-30/entries "{}"); expect "invalid date is 400" 400 "$R"
R=$(req $A GET "/api/v1/foods/barcode/12345"); expect "short barcode is 400" 400 "$R"
R=$(req $A POST /api/v1/foods '{"name":"My Protein Shake","kcal100":80,"protein100":12,"carbs100":4,"fat100":1.5,"servings":[{"label":"1 shake","amount":300}]}'); expect "create custom food" 201 "$R"
CFOOD=$(echo "$R" | body | jq_ 'j.id')
R=$(req $B GET /api/v1/foods/$CFOOD); expect "custom food is private to its owner" 404 "$R"

echo "# training"
R=$(req $A GET "/api/v1/exercises?q=bench+press"); expect "search exercises" 200 "$R"
BENCH=$(echo "$R" | body | jq_ 'j.data.find(e=>e.name==="Bench Press (Barbell)").id')
R=$(req $A GET "/api/v1/exercises?muscle=quads&limit=100"); expect "filter by muscle" 200 "$R"
SQUAT=$(echo "$R" | body | jq_ 'j.data.find(e=>e.name==="Squat (Barbell)").id')
now=$(node -e "console.log(Date.now())")
iso() { node -e "console.log(new Date($now - $1*1000).toISOString())"; }
W1ID=$(node -e "console.log(require('crypto').randomUUID())")
mk() { # id title startOffset endOffset benchWeight reps visibility
cat <<J
{"id":"$1","title":"$2","startedAt":"$(iso $3)","endedAt":"$(iso $4)","visibility":"$7","caption":"Felt strong","exercises":[
 {"exerciseId":"$BENCH","sets":[{"setType":"warmup","weightKg":40,"reps":10},{"setType":"normal","weightKg":$5,"reps":$6},{"setType":"normal","weightKg":$5,"reps":$6}]},
 {"exerciseId":"$SQUAT","sets":[{"setType":"normal","weightKg":100,"reps":5}]}]}
J
}
R=$(req $A POST /api/v1/workouts "$(mk $W1ID 'Push day' 700000 697000 80 8 followers)"); expect "save first workout" 201 "$R"
[ "$(echo "$R" | body | jq_ 'j.prCount')" = "0" ] && ok "first workout has no PRs (baseline only)" || bad "baseline" "$(echo "$R" | body | jq_ 'j.prCount')"
[ "$(echo "$R" | body | jq_ 'j.totalSets')" = "3" ] && ok "warmup excluded from set count (3)" || bad "sets" "$(echo "$R" | body | jq_ 'j.totalSets')"
[ "$(echo "$R" | body | jq_ 'j.totalVolumeKg')" = "1780" ] && ok "volume = 2x80x8 + 100x5 = 1780" || bad "volume" "$(echo "$R" | body | jq_ 'j.totalVolumeKg')"
R=$(req $A POST /api/v1/workouts "$(mk $W1ID 'Push day' 700000 697000 80 8 followers)"); expect "retry same workout id returns the existing workout" 201 "$R"
R=$(req $A GET /api/v1/workouts); [ "$(echo "$R" | body | jq_ 'j.data.length')" = "1" ] && ok "retry didn't duplicate the workout" || bad "dup workout" "$(echo "$R" | body | head -c 200)"
W2ID=$(node -e "console.log(require('crypto').randomUUID())")
R=$(req $A POST /api/v1/workouts "$(mk $W2ID 'Push day 2' 3600 600 85 8 public)"); expect "save heavier workout" 201 "$R"
PRC=$(echo "$R" | body | jq_ 'j.prCount'); [ "$PRC" -ge 1 ] && ok "second, heavier workout earns PRs ($PRC)" || bad "PRs" "$PRC"
echo "$R" | body | jq_ 'j.exercises[0].records.map(r=>r.recordType+"="+r.value).join(", ")' | sed 's/^/       bench records: /'
R=$(req $A GET /api/v1/exercises/$BENCH/stats); expect "exercise stats" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.series.length')" = "2" ] && ok "stats series has 2 workouts" || bad "series" ""
R=$(req $A POST /api/v1/workouts "$(mk $(node -e "console.log(require('crypto').randomUUID())") 'Future' -3600 -7200 50 5 private)"); expect "workout ending in the future rejected" 400 "$R"
R=$(req $A GET "/api/v1/exercises/previous?ids=$BENCH,$SQUAT"); expect "previous sets" 200 "$R"
[ "$(echo "$R" | body | jq_ "j.data['$BENCH'].length")" = "3" ] && ok "previous sets returned for bench" || bad "previous" ""
R=$(req $A POST /api/v1/routines/from-workout/$W2ID '{}'); expect "save workout as routine" 201 "$R"
RID=$(echo "$R" | body | jq_ 'j.id')
R=$(req $A GET /api/v1/routines); [ "$(echo "$R" | body | jq_ 'j.routines.length')" = "1" ] && ok "routine listed" || bad "routines" ""
R=$(req $B GET /api/v1/routines/$RID); expect "private routine hidden from bo" 404 "$R"
R=$(req $A GET "/api/v1/reports/training?from=$(date -v-30d +%Y-%m-%d)&to=$TODAY"); expect "training report" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.totals.workouts')" = "2" ] && ok "report counts 2 workouts" || bad "report" "$(echo "$R" | body | head -c 300)"

echo "# social & privacy"
R=$(req $B GET /api/v1/feed); expect "bo's feed" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.data.length')" = "0" ] && ok "feed empty before following" || bad "feed pre-follow" ""
R=$(req $B GET /api/v1/feed/discover); expect "discover feed" 200 "$R"
[ "$(echo "$R" | body | jq_ 'j.data.filter(p=>p.author.username==="ann'$SUF'").length')" = "1" ] && ok "discover shows ann's public workout but not her followers-only one" || bad "discover" "$(echo "$R" | body | jq_ 'j.data.length')"
R=$(req $B GET /api/v1/workouts/$W1ID); expect "followers-only workout hidden from non-follower" 404 "$R"
R=$(req $B GET /api/v1/workouts/$W2ID); expect "public workout visible to bo" 200 "$R"
R=$(req $B POST /api/v1/users/ann$SUF/follow); expect "bo follows ann" 200 "$R"
R=$(req $B GET /api/v1/feed); [ "$(echo "$R" | body | jq_ 'j.data.length')" = "2" ] && ok "feed now shows both of ann's workouts" || bad "feed post-follow" "$(echo "$R" | body | jq_ 'j.data.length')"
POST=$(echo "$R" | body | jq_ 'j.data[0].id')
R=$(req $B GET /api/v1/workouts/$W1ID); expect "follower can now see followers-only workout" 200 "$R"
R=$(req $B POST /api/v1/posts/$POST/like); expect "like post" 204 "$R"
R=$(req $B POST /api/v1/posts/$POST/like); expect "like is idempotent" 204 "$R"
R=$(req $B POST /api/v1/posts/$POST/comments '{"body":"Nice lift!"}'); expect "comment" 201 "$R"
R=$(req $A GET /api/v1/notifications/unread-count); [ "$(echo "$R" | body | jq_ 'j.count')" -ge 3 ] && ok "ann has notifications (follow, like, comment)" || bad "notifications" "$(echo "$R" | body)"
R=$(req $A GET /api/v1/feed); [ "$(echo "$R" | body | jq_ 'j.data.find(p=>p.id==="'$POST'").likeCount')" = "1" ] && ok "like counted exactly once" || bad "likeCount" ""
R=$(req $A GET /api/v1/users/bo$SUF); [ "$(echo "$R" | body | jq_ 'j.followers')" = "0" ] && ok "bo has 0 followers" || bad "bo followers" ""
R=$(req $A GET /api/v1/users/ann$SUF); [ "$(echo "$R" | body | jq_ 'j.followers')" = "1" ] && ok "ann has 1 follower" || bad "ann followers" "$(echo "$R" | body | head -c 300)"
R=$(req $A PATCH /api/v1/me '{"isPrivate":true}'); expect "ann goes private" 200 "$R"
R=$(req $B GET /api/v1/feed/discover); [ "$(echo "$R" | body | jq_ 'j.data.filter(p=>p.author.username==="ann'$SUF'").length')" = "0" ] && ok "private account removed from discover" || bad "private discover" ""
R=$(req $A POST /api/v1/users/bo$SUF/block); expect "ann blocks bo" 204 "$R"
R=$(req $B GET /api/v1/users/ann$SUF); expect "blocked user can't see profile" 404 "$R"
R=$(req $B GET /api/v1/workouts/$W2ID); expect "blocked user can't see public workout" 404 "$R"
R=$(req $A GET /api/v1/users/ann$SUF); [ "$(echo "$R" | body | jq_ 'j.followers')" = "0" ] && ok "block removed the follow and recounted" || bad "block recount" "$(echo "$R" | body | head -c 300)"
R=$(req $A DELETE /api/v1/workouts/$W2ID); expect "delete workout" 204 "$R"
R=$(req $A GET /api/v1/exercises/$BENCH/stats); [ "$(echo "$R" | body | jq_ 'j.series.length')" = "1" ] && ok "stats rebuilt after delete" || bad "rebuild" ""
R=$(req $A GET /api/v1/health); expect "health" 200 "$R"

echo; echo "passed: $pass  failed: $fail"; rm -f $A $B; [ $fail -eq 0 ]
