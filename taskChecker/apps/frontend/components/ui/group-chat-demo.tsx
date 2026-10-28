import GroupChat from "@/components/ui/group-chat";

export default function GroupChatDemo() {
  return (
    <div className="flex w-full max-w-md items-center justify-center p-8">
      <GroupChat
        channel="design-team"
        members={["alain00", "maya", "jonas", "priya"]}
        extra={2}
        typing="maya"
        messages={[
          {
            name: "alain00",
            text: "Pushed the new avatar API, take a look",
            time: "9:41",
          },
          {
            name: "alain00",
            text: "It's deterministic now, same handle same face",
          },
          {
            name: "maya",
            text: "Nice, trying it on the settings page",
            time: "9:44",
          },
          {
            name: "jonas",
            text: "Facepile looks great in the header",
            time: "9:46",
          },
        ]}
      />
    </div>
  );
}
