{-# LANGUAGE TypeOperators #-}
{-# LANGUAGE OverloadedStrings #-}

module Utilities (readLastRecordedModTime,
                  readFileInDatabase,
                  hibernate, 
                  SleepCount) where

import Flowtypes
import Bluefin.IO
import Bluefin.Eff
import Bluefin.Stream
import Database.PostgreSQL.Simple
import qualified Control.Concurrent as C

data FlowTideE e = FlowTide (IOE e) (Stream [Char] e)


-- DATABASE UTILS --

readFileInDatabase :: (e :> es) => FlowTideE e -> Eff es ()
readFileInDatabase (FlowTide i s) = do 
  conn <- getConnection
  _ <- execute conn tableCreateSql [fname :: [Char]]
  qresult <- query conn sqlContentSelect [fname :: [Char]]
  case (listToMaybe qresult) of
    Nothing  -> return Nothing
    Just r   -> return . Just $ content r


  -- GENERAL UTILS
listToMaybe :: [a] -> Maybe a
listToMaybe []    = Nothing
listToMaybe (x:_) = Just x


-- TIME UTILS --
-- General Sleeper Function 
hibernate ::  SleepCount -> IO ()
hibernate sleep = C.threadDelay (sleep*1000000)



getConnection :: IO Connection
getConnection =
  connect $
    defaultConnectInfo
      { connectHost = "127.0.0.1"
      , connectDatabase = "flowtide"
      , connectUser = "postgres"
      , connectPassword = "postgres"
      }