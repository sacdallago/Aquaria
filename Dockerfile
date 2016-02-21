FROM node:argon

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app

#Install Browserify
RUN npm install -g browserify@9.0.3

RUN npm install
RUN npm run setupTemplates
RUN npm run updateJars

RUN bash build.sh

EXPOSE 8009
CMD [ "npm", "start" ]

# docker build -t rostlab/aquaria .
# docker run -p 8009:8009 -d rostlab/aquaria