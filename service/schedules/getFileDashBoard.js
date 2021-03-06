const schedule = require("node-schedule");
const AccountModel = require("../../database/account");
const db = require("../../database");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const s3 = require("../aws/s3");
const moment = require("moment-timezone");
const fs = require("fs");

let rule = new schedule.RecurrenceRule();
rule.hour = 6;
rule.minute = 30;
rule.tz = "Asia/Ho_Chi_Minh";

// let rule = "* * * * * *";

const formatNumber = (value) => {
  if (Number(value) < 10) {
    return `0${value}`;
  }
  return `${value}`;
};

const getFileId = async (service, fireDate) => {
  try {
    var todayFile = `${moment()
      .tz("Asia/Ho_Chi_Minh")
      .format("YYYY-MM-DD")}.json`;
    let res = await service.files.list({
      q: "parents='1SKMy1V4PQZtX4UsbC-IZpi7sm_Bda4EJ'",
    });

    let fileArr = res?.data?.files;
    let newFile = fileArr?.filter((item) => item?.name === todayFile);
    if (newFile?.length > 0) {
      return [newFile[0]?.id, fileArr];
    }
  } catch (err) {
    console.log(err);
  }
};

const processingData = (data) => {
  let dataKey = Object.keys(data);
  return data;
};

const job = {
  run: () => {
    console.log("Read files from google drive service is running...");
    let cronjob = schedule.scheduleJob(rule, async (fireDate) => {
      const oauth2Client = new google.auth.OAuth2(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
      );
      oauth2Client.setCredentials({
        access_token: process.env.ACCESS_TOKEN,
        refresh_token: process.env.REFRESH_TOKEN,
        expiry_date: true,
      });
      const service = google.drive({
        version: "v3",
        auth: oauth2Client,
        scopes: [
          "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.photos.readonly https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.appdata",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive.metadata",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
          "https://www.googleapis.com/auth/drive.photos.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ],
      });

      let [fileId, fileArr] = await getFileId(service, fireDate);
      let { data } = await service.files.get({
        alt: "media",
        fileId: fileId,
      });
      data = processingData(data);
      var todayFile = `${moment()
        .tz("Asia/Ho_Chi_Minh")
        .format("YYYY-MM-DD")}.json`;
      let buf = Buffer.from(JSON.stringify(data));
      let uploadData = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `visualize/${todayFile}`,
        Body: buf,
        ContentEncoding: "base64",
        ContentType: "application/json",
      };
      // UPload current day file
      s3.upload(uploadData, function (err, data) {
        if (err) {
          console.log(err);
          console.log("Error uploading data: ", data);
        } else {
          console.log("succesfully uploaded!!!");
        }
      });
      // Upload total calculated file
    });
  },
};
module.exports = job;
