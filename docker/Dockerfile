FROM mattermost/mattermost-preview:11.1.0

RUN apt update && apt install -y jq
WORKDIR /mm

RUN <<'EOF'
set -e
jq '.ServiceSettings.EnableLocalMode = true
    | .ServiceSettings.EnableUserAccessTokens = true
    | .ServiceSettings.TeamSettings.EnableOpenServer = true' \
  mattermost/config/config_docker.json > mattermost/config/tmp
mv mattermost/config/tmp mattermost/config/config_docker.json
EOF
