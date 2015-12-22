#!/bin/bash
kill `ps -A|awk '/emojimatch.fcgi/{print $1}'`
