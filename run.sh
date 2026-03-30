while true; do
  if [ ! -e ./node_modules ]; then
    npm i
  fi

  npm run start
  sleep 1
done
