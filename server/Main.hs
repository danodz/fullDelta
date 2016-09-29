module Main where
import qualified Network.WebSockets as WS
import qualified Data.ByteString.Lazy.Char8 as BS8
import Control.Concurrent (forkIO, MVar, newMVar, takeMVar, putMVar, modifyMVar_, readMVar, threadDelay)

instance Show (MVar a) where
    show x = "MVar"

data Ship = Ship { x :: Float
                 , y :: Float
                 , angle :: Float
                 , speed :: Float
                 }
    deriving (Show)

data ShipCommand = ShipCommand { setX :: Float
                               }

data GameState = GameState { ship :: Ship
                           }
    deriving (Show)

data GameStateCommand = SetX

app :: MVar [GameStateCommand] -> WS.ServerApp
app gameStateCommands pending = do
    conn <- WS.acceptRequest pending
    WS.forkPingThread conn 30
    WS.sendDataMessage conn $ WS.Text $ BS8.pack "Hello"

    read conn gameStateCommands
  where
    read conn commands = do
        msg <- WS.receiveDataMessage conn
        print msg
        modifyMVar_ commands (\x -> return $ SetX : x)
        read conn commands

update :: MVar [GameStateCommand] -> GameState -> IO ()
update gameStateCommands gameState = do
    commands <- readMVar gameStateCommands
    mapM_ (\command -> case command of
        SetX -> print 0
      ) commands
    threadDelay 33333
    update gameStateCommands gameState

main :: IO ()
main = do
    putStrLn "Running fullDelta server"
    putStrLn "Welcome to the shit!"
    commands <- newMVar []
    forkIO $ WS.runServer "0.0.0.0" 9000 $ app commands
    forkIO $ update commands $ GameState $ Ship 0 0 0 0
    getLine
    return ()
