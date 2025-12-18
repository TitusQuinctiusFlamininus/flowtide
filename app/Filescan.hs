module Filescan where

import Pipes
import Data.Time.Clock

scan :: FilePath -> Producer UTCTime IO ()
scan path = do
    modTime    <- lift getModificationTime path    
    oldModTime <- lift getLastRecordedModTime
    case (modTime - oldModTime) of
        0  -> scan
        _  -> do 
                newContent <- lift getFileContent
                oldContent <- lift readFileInDatabase
                yield (newContent, oldContent)