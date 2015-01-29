export PATH=$PATH:/usr/local/bin 
if [ $# -ne 1 ]
then
       DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
else
        DIR=$1

fi
#echo running frm dir: $DIR
cd $DIR

#this is required for plist startup as it doesn't have a context
# see http://stackoverflow.com/questions/6770411/mac-os-x-lion-no-longer-recognizes-environment-plist
./stop.sh > /dev/null
if [ -f log/console.log ]
then
        rm log/console.log
fi
if [ -f log/error.log ]
then
        rm log/error.log
fi
if [ -f log/debug.log ]
then
        rm log/debug.log
fi
if [ -f log/exceptions.log ]
then
        rm log/exceptions.log
fi
./node_modules/forever/bin/forever start -l $DIR/log/console.log -e $DIR/log/error.log app.js

#forever start -l $DIR/log/console.log -e $DIR/log/error.log app.js

