import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import * as dotenv from 'dotenv';
import {BrowserRouter, Router} from "react-router-dom";
dotenv.config();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>\
      <BrowserRouter>
          <App />
      </BrowserRouter>
  </React.StrictMode>,
)
