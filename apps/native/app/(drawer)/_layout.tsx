import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";

import { NAV_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/use-color-scheme";

const DrawerLayout = () => {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === "dark" ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <Drawer
      initialRouteName="(tabs)"
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTitleStyle: {
          color: theme.text,
        },
        headerTintColor: theme.text,
        drawerStyle: {
          backgroundColor: theme.background,
        },
        drawerActiveBackgroundColor: theme.card,
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.text,
        drawerLabelStyle: {
          color: theme.text,
          fontWeight: "700",
        },
        sceneStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerTitle: "Home",
          drawerLabel: "Home",
          drawerIcon: ({ size, color }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="index"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
        }}
      />
    </Drawer>
  );
};

export default DrawerLayout;
