# Aquaria
Simplifying the generation of insight from protein structures


----------
Pre Installation
- (MacOS Only) install command line tools for Mac
	Start XCode.
	Go to XCode/Preferences.
	Click the "Downloads" tab.
	Click "Components".
	Click "Install" on the command line tools line.

- Install nodejs
	from http://nodejs.org/

--------
Installation
- load node prereqs
	Open Terminal and cd to root of Aquaria directory
	run:
	 - npm install
	 - npm run setupTemplates
	 - npm run updateJars
	 - build.sh
  you may edit the site.json and change the port if required.
  
-------
Operation
- Start Stop Server
	Open Terminal and cd to root of Aquaria directory
	run either start.sh or stop.sh

-------
Changing the code
- Aquaria uses requirejs to handle both server and client dependencies. After making changes to the client javascript files, run build.sh to compile the client files into 1 large file stored as public/javascripts/aquaria.js


