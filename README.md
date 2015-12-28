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

- Install npm and nodejs
	from http://nodejs.org/: 

```
curl -L https://npmjs.org/install.sh | sudo sh`
sudo npm cache clean -f
sudo npm install -g n	
```

Aquaria is using node version v0.10.33
	
- install browserify
  `sudo npm install -g browserify@9.0.3`

--------
Installation
 - git clone https://github.com/ODonoghueLab/Aquaria.git
 
- load node prereqs
	Open Terminal and cd to root of Aquaria directory
	run:
	 - npm install
	 - npm run setupTemplates
	 - npm run updateJars
	 - ./build.sh
  you may edit the site.json and change the port if required.
  
-------
Operation
To start and stop the server:
	
	Open Terminal and cd to root of Aquaria directory
	run either `sh start.sh` or `sh stop.sh`

-------
Changing the code
- Aquaria uses requirejs to handle both server and client dependencies. After making changes to the client javascript files, run build.sh to compile the client files into 1 large file stored as public/javascripts/aquaria.js


