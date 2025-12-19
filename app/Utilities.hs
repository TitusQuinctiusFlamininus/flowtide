{-# LANGUAGE OverloadedStrings #-}

module Utilities (readLastRecordedModTime,
                  readFileInDatabase,
                  hibernate, 
                  SleepCount) where

import Data.Time.Clock
import System.Directory
import Database.PostgreSQL.Simple
import qualified Control.Concurrent as C


-- TYPE SYNONYMS
type SleepCount   = Int


readLastRecordedModTime :: FilePath -> IO UTCTime
readLastRecordedModTime = undefined

-- TIME UTILS --
-- General Sleeper Function 
hibernate ::  SleepCount -> IO ()
hibernate sleep = C.threadDelay (sleep*1000000)



-- DATABASE CONNECTION UTILS --

readFileInDatabase :: FilePath -> IO [Char]
readFileInDatabase = undefined


getConnection :: IO Connection
getConnection =
  connect $
    defaultConnectInfo
      { connectHost = "127.0.0.1"
      , connectDatabase = "flowtide"
      , connectUser = "postgres"
      , connectPassword = "postgres"
      }