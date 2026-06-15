import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Box,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useState } from "react";
import { login } from "../../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = login(request);

  return json({ errors, polarisTranslations: require("@shopify/polaris/locales/en.json") });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json({ errors });
};

export default function Auth() {
  const { errors: loaderErrors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const errors = actionData?.errors || loaderErrors;

  return (
    <AppProvider i18n={require("@shopify/polaris/locales/en.json")}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Log in
                </Text>
                <TextField
                  type="text"
                  name="shop"
                  label="Shop domain"
                  helpText="e.g. my-shop-domain.myshopify.com"
                  value={shop}
                  onChange={setShop}
                  autoComplete="on"
                  error={errors?.shop}
                />
                <Button submit variant="primary">
                  Log in
                </Button>
              </BlockStack>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </AppProvider>
  );
}
