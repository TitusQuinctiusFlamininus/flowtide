{-# LANGUAGE OverloadedStrings #-}

module Utilities (readLastRecordedModTime) where

import Data.Time.Clock
import System.Directory
import Database.PostgreSQL.Simple

readLastRecordedModTime :: FilePath -> IO UTCTime
readLastRecordedModTime = undefined


-- DATABASE CONNECTION UTILS
getConnection :: IO Connection
getConnection =
  connect $
    defaultConnectInfo
      { connectHost = "127.0.0.1"
      , connectDatabase = "flowtide"
      , connectUser = "postgres"
      , connectPassword = "postgres"
      }