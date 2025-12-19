{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE DeriveAnyClass #-}
{-# LANGUAGE DeriveGeneric  #-}

module Flowtypes where

import Data.Time.Clock
import GHC.Generics (Generic)
import Database.PostgreSQL.Simple

data SomeTable = SomeTable { id :: Int, content :: [Char], flowtime :: UTCTime } deriving (Generic, ToRow, FromRow)


-- TYPE SYNONYMS
type SleepCount   = Int
type FileName     = [Char]
type Content      = [Char]    

readLastRecordedModTime :: FilePath -> IO UTCTime
readLastRecordedModTime = undefined

sqlContentSelect :: Query
sqlContentSelect = "SELECT * FROM ? ORDER BY timestamptz DESC LIMIT 1;"


tableCreateSql :: Query
tableCreateSql = "CREATE TABLE IF NOT EXISTS ? ('id' integer PRIMARY KEY, 'content' string, 'flowtime' timestamptz NOT NULL DEFAULT now());"

