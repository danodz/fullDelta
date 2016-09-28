module Main where
import qualified Network.WebSockets as WS

app :: WS.ServerApp
app pending = do
    conn <- WS.acceptRequest pending
    WS.forkPingThread conn 30
    return ()

main :: IO ()
main = do
    putStrLn "Running fullDelta server"
    putStrLn "Welcome to the shit!"
    WS.runServer "0.0.0.0" 9000 app
