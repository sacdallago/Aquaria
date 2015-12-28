#!/bin/sh

if [ $# -ne 1 ]
then
       DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
else
        DIR=$1

fi
cd $DIR

PROGRAM_DIR="$(dirname "$DIR")"
echo PROGRAM_DIR is $PROGRAM_DIR
PROGRAM="$(basename $DIR)"
echo PROGRAM is $PROGRAM

set -o nounset
#pid=$(ps -ef | grep node | grep $PROGRAM | grep forever | awk '{print $2}')
#VALUE=$pid
#if [ -z ${VALUE} ];
#    then
#        echo no forever process running
#    else
#	kill $pid
#	echo stopping forever pid=$pid
#fi
#
#pid=$(ps -ef | grep node | grep $PROGRAM | awk '{print $2}')
#VALUE=$pid
#if [ -z ${VALUE} ];
#    then
#        echo no $PROGRAM process running
#    else
#        kill $pid
#	echo stopping $PROGRAM pid=$pid
#fi
./node_modules/forever/bin/forever stop app.js

