module Main where
import qualified Network.WebSockets as WS
import qualified Data.ByteString.Lazy.Char8 as BS8
import Control.Concurrent (forkIO, MVar, newMVar, takeMVar, putMVar, modifyMVar_, readMVar, threadDelay)
import qualified Data.Aeson as AE
import Data.Maybe

instance Show (MVar a) where
    show x = "MVar"

data Ship = Ship { x :: Float
                 , y :: Float
                 , angle :: Float
                 , speed :: Float
                 }
    deriving (Show)

data GameState = GameState { ship :: Ship
                           }
    deriving (Show)

app :: MVar [[String]] -> WS.ServerApp
app gameStateCommands pending = do
    conn <- WS.acceptRequest pending
    WS.forkPingThread conn 30
    WS.sendDataMessage conn $ WS.Text $ BS8.pack "Hello"

    readMsg conn gameStateCommands
  where
    readMsg conn commands = do
        msg <- (WS.receiveData conn) :: IO (BS8.ByteString)
        modifyMVar_ commands (\x ->
            return $ fromMaybe [""] ((AE.decode msg) :: Maybe [String]) : x)
        readMsg conn commands

update :: MVar [[String]] -> GameState -> IO ()
update gameStateCommands gameState = do
    commands <- readMVar gameStateCommands
    mapM_ (\command -> case head command of
        "SetAngle" -> print (( read $ last command ) :: Float)
        "SetSpeed" -> print (( read $ last command ) :: Float)
        _ -> print 2
      ) commands
    modifyMVar_ gameStateCommands (\x -> return [])
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
