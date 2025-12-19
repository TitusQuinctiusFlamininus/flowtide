module Filescan where


import Utilities
import Pipes
import Data.Time.Clock
import System.Directory
import qualified Control.Concurrent as C

type SleepCount   = Int
type TDDFile      = FilePath

type NewContent   = [Char]
type OldContent   = [Char]

-- SleepCount is the number of seconds to wait before rescanning the directory file for changes
-- TDDFile is the file being scanned inside a directory, that might have changed during a TDD process
scan :: SleepCount -> TDDFile -> Producer (NewContent, OldContent) IO ()
scan sleep tfile = do
    modTime    <- lift $ getModificationTime tfile    
    oldModTime <- lift $ readLastRecordedModTime tfile
    case (diffUTCTime modTime oldModTime) of
        0  -> (lift $ C.threadDelay (sleep*1000000)) >> (scan sleep tfile)
        _  -> do 
                newContent <- lift $ readFile tfile
                oldContent <- lift $ readFileInDatabase tfile
                yield (newContent, oldContent)