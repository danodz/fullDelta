module Main where
import qualified Network.WebSockets as WS
import qualified Data.ByteString.Lazy.Char8 as BS8
import Control.Concurrent (forkIO, MVar, newMVar, takeMVar, putMVar, modifyMVar_, readMVar, threadDelay)
import qualified Data.Aeson as AE
import Data.Maybe
import Control.Monad

instance Show (MVar a) where
    show x = "MVar"

data Ship = Ship { x :: Float
                 , y :: Float
                 , angle :: Float
                 , speed :: Float
                 , connection :: WS.Connection
                 }
instance Show Ship where
  show (Ship x y angle speed _) = show x ++ ", " ++ show y ++ ", " ++ show angle ++ ", " ++ show speed

data GameState = EmptyGameState | GameState { ship :: Ship
                                            }
    deriving (Show)

app :: MVar [[String]] -> MVar GameState -> WS.ServerApp
app gameStateCommands gameState pending = do
    conn <- WS.acceptRequest pending
    WS.forkPingThread conn 30
    WS.sendDataMessage conn $ WS.Text $ BS8.pack "Hello"
    modifyMVar_ gameState (\x -> return $ GameState $ Ship 0 0 0 0 conn )

    readMsg conn gameStateCommands
  where
    readMsg conn commands = do
        msg <- (WS.receiveData conn) :: IO (BS8.ByteString)
        modifyMVar_ commands (\x ->
            return $ fromMaybe [""] ((AE.decode msg) :: Maybe [String]) : x)
        readMsg conn commands

update :: MVar [[String]] -> MVar GameState -> IO ()
update gameStateCommands gameStateVar = do
    modifyMVar_ gameStateVar (\gameState -> do
        case gameState of
            EmptyGameState -> return EmptyGameState
            GameState _ -> do
                print gameState
                commands <- readMVar gameStateCommands
                newState <- foldM (\state command -> case head command of
                    "SetAngle" -> return gameState { ship = (ship gameState) {angle = (( read $ last command ) :: Float)} }
                    "SetSpeed" -> return gameState { ship = (ship gameState) {speed = (( read $ last command ) :: Float)} }
                    _ -> return gameState
                    ) gameState commands
        
                return newState { ship = updateShip $ ship newState
                                }
        )
    modifyMVar_ gameStateCommands (\x -> return [])
    threadDelay 33333
    update gameStateCommands gameStateVar

-- Too many ship
updateShip :: Ship -> Ship
updateShip ship = ship { x = x ship + cos ((angle ship) * pi / 180) * (speed ship)
                       , y = y ship + sin ((angle ship) * pi / 180) * (speed ship)
                       }

main :: IO ()
main = do
    putStrLn "Running fullDelta server"
    putStrLn "Welcome to the shit!"
    commands <- newMVar []
    gameState <- newMVar $ EmptyGameState
    forkIO $ WS.runServer "0.0.0.0" 9000 $ app commands gameState
    forkIO $ update commands gameState
    getLine
    return ()
