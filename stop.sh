#!/bin/sh

PROGRAM=Aquaria

set -o nounset
pid=$(ps -ef | grep node | grep $PROGRAM | grep forever | awk '{print $2}')
VALUE=$pid
if [ -z ${VALUE} ];
    then
        echo no forever process running
    else
	kill $pid
	echo stopping forever pid=$pid
fi

pid=$(ps -ef | grep node | grep $PROGRAM | awk '{print $2}')
VALUE=$pid
if [ -z ${VALUE} ];
    then
        echo no $PROGRAM process running
    else
        kill $pid
	echo stopping $PROGRAM pid=$pid
fi

