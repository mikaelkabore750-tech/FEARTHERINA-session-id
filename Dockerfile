FROM node:lts-buster

RUN git clone https://github.com/mikaelkabore750-tech/FEARTHERINA-session-id /root/FEARTHERINA-session-id

WORKDIR /root/FEARTHERINA-SESSION-ID

COPY package.json .
RUN npm i
COPY . .

EXPOSE 8000

CMD ["npm","run","Feartherina"]
