module Main (main) where

main :: IO ()
main = do 
    putStrLn "Enter the Test Code Directory to monitor: "
    getLine >>= \tdir -> putStrLn ("Test Code Directory: "++tdir)
