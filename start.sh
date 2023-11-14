if [ -e ./node_modules ]; then
  npm i
fi

if [ -z "$1" ]; then
    target="CapCut-TTS"
else
    target="$1"
fi

echo will be start $target ....
screen -T xterm-256color -dmS $target sh run.sh