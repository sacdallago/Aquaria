# Aquaria
Simplifying the generation of insight from protein structures


## Install Via Docker

Make sure you have [Docker](https://www.docker.com/) installed. You can either:

- Build the Dockerfile in this repository via:
  - `docker build -t rostlab/aquaria .`
  - `docker run -p 8009:8009 -d rostlab/aquaria`
- Or pull the image from dockerhub via:
  -  `docker run -p 8009:8009 -d rostlab/aquaria`

The node instance will then be running in the background. In linux you can access aquaria going to: `http://localhost:8009`, while if you use Os X you first need to get the ip address of the docker default instance `docker-machine ip default` and then you can navigate to that address, like: `http://192.168.99.100:8009`.      
To view the log of Aquaria:
- Get the machine's ID by calling `docker ps`. You will get something like:

  ```
  CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS                    NAMES
2e52a0ce2418        rostlab/aquaria     "npm start"         5 seconds ago       Up 4 seconds        0.0.0.0:8009->8009/tcp   awesome_northcutt
```

- Get the logs by calling `docker logs 2e52a0ce2418` (from the example above)
  

## Install manually
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


