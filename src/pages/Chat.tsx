import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: number;
  text: string;
  sender: "user" | "other";
  senderName: string;
  time: string;
}

const mockConversations = [
  {
    id: 1,
    name: "John S.",
    lastMessage: "Great round yesterday! Want to play again this weekend?",
    time: "2h ago",
    unread: 1,
    avatar: "JS",
  },
  {
    id: 2,
    name: "Mike T.",
    lastMessage: "I found a clover on hole 7!",
    time: "5h ago",
    unread: 1,
    avatar: "MT",
  },
  {
    id: 3,
    name: "Lucky Golf Team",
    lastMessage: "Welcome to Lucky Golf! Start earning clovers today.",
    time: "1d ago",
    unread: 0,
    avatar: "LG",
  },
];

const Chat = () => {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Great round yesterday! Want to play again this weekend?",
      sender: "other",
      senderName: "John S.",
      time: "2:30 PM",
    },
    {
      id: 2,
      text: "Absolutely! I'm free Saturday morning",
      sender: "user",
      senderName: "You",
      time: "2:32 PM",
    },
  ]);

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      setMessages([
        ...messages,
        {
          id: messages.length + 1,
          text: messageInput,
          sender: "user",
          senderName: "You",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setMessageInput("");
    }
  };

  if (selectedConversation) {
    const conversation = mockConversations.find(c => c.id === selectedConversation);
    
    return (
      <AppLayout>
        <div className="flex flex-col h-[calc(100vh-8rem)]">
          {/* Chat Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversation(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {conversation?.avatar}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">{conversation?.name}</h2>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-[10px] mt-1 ${
                    message.sender === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>
                    {message.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="flex-1"
              />
              <Button onClick={handleSendMessage} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold">Messages</h1>
              <p className="text-muted-foreground text-sm">Chat with fellow golfers</p>
            </div>
          </div>
          <MessageCircle className="w-6 h-6 text-primary" />
        </motion.div>

        {/* Conversations List */}
        <div className="space-y-3">
          {mockConversations.map((conversation, index) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedConversation(conversation.id)}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {conversation.avatar}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{conversation.name}</h3>
                  <span className="text-xs text-muted-foreground">{conversation.time}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
              </div>
              {conversation.unread > 0 && (
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {conversation.unread}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Chat;
