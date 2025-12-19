module Filescan where


import Utilities
import Pipes
import Data.Time.Clock
import System.Directory
import qualified Control.Concurrent as C

scan :: FilePath -> Producer UTCTime IO ()
scan path = do
    modTime    <- lift $ getModificationTime path    
    oldModTime <- lift $ readLastRecordedModTime path
    case (modTime - oldModTime) of
        0  -> lift $ C.threadDelay 5000000 >> scan
        _  -> do 
                newContent <- lift $ readFile path
                oldContent <- lift readFileInDatabase
                yield (newContent, oldContent)