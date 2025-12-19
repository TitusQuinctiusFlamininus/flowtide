{-# LANGUAGE OverloadedStrings #-}

module Utilities (readLastRecordedModTime,
                  readFileInDatabase,
                  hibernate, 
                  SleepCount) where

import Flowtypes
import Database.PostgreSQL.Simple
import qualified Control.Concurrent as C


-- GENERAL UTILS
listToMaybe :: [a] -> Maybe a
listToMaybe []    = Nothing
listToMaybe (x:_) = Just x


-- TIME UTILS --
-- General Sleeper Function 
hibernate ::  SleepCount -> IO ()
hibernate sleep = C.threadDelay (sleep*1000000)



-- DATABASE UTILS --

readFileInDatabase :: FileName -> IO (Maybe Content)
readFileInDatabase fname = do 
  conn <- getConnection
  _ <- execute conn tableCreateSql [fname :: [Char]]
  qresult <- query conn sqlContentSelect [fname :: [Char]]
  case (listToMaybe qresult) of
    Nothing  -> return Nothing
    Just r   -> return . Just $ content r


  

getConnection :: IO Connection
getConnection =
  connect $
    defaultConnectInfo
      { connectHost = "127.0.0.1"
      , connectDatabase = "flowtide"
      , connectUser = "postgres"
      , connectPassword = "postgres"
      }