// utils/database.js
const axios = require('axios');
const qs = require('querystring');
require('dotenv').config();

const databaseURL = process.env.FIREBASE_DATABASE_URL;

// Function to get data from Firebase Realtime Database
const getData = async (path) => {
  try {
    const response = await axios.get(`${databaseURL}/${path}.json`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Function to update data in Firebase Realtime Database
const updateData = async (path, data) => {
  try {
    await axios.patch(`${databaseURL}/${path}.json`, data);
  } catch (error) {
    throw error;
  }
};

module.exports = { getData, updateData };
