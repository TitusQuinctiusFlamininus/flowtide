{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric  #-}

module Utilities (readLastRecordedModTime,
                  readFileInDatabase,
                  hibernate, 
                  SleepCount) where

import GHC.Generics (Generic)
import Data.Time.Clock
import Database.PostgreSQL.Simple
import qualified Control.Concurrent as C

data SomeTable = SomeTable { id :: Int, content :: [Char], flowtime :: UTCTime } deriving (Generic, ToRow, FromRow)


-- TYPE SYNONYMS
type SleepCount   = Int
type FileName     = [Char]
type Content      = [Char]    

readLastRecordedModTime :: FilePath -> IO UTCTime
readLastRecordedModTime = undefined

-- TIME UTILS --
-- General Sleeper Function 
hibernate ::  SleepCount -> IO ()
hibernate sleep = C.threadDelay (sleep*1000000)

sqlContentSelect :: Query
sqlContentSelect = "SELECT * FROM ? ORDER BY timestamptz DESC LIMIT 1;"


tableCreateSql :: Query
tableCreateSql = "CREATE TABLE IF NOT EXISTS ? ('id' integer PRIMARY KEY, 'content' string, 'flowtime' timestamptz NOT NULL DEFAULT now());"


-- DATABASE CONNECTION UTILS --

readFileInDatabase :: FileName -> IO (Maybe Content)
readFileInDatabase fname = do 
  conn <- getConnection
  _ <- execute conn tableCreateSql [fname :: [Char]]
  qresult <- query conn sqlContentSelect [fname :: [Char]]
  case qresult of 
    []  -> return Nothing
    _   -> return . Just . content $ head qresult

  

getConnection :: IO Connection
getConnection =
  connect $
    defaultConnectInfo
      { connectHost = "127.0.0.1"
      , connectDatabase = "flowtide"
      , connectUser = "postgres"
      , connectPassword = "postgres"
      }