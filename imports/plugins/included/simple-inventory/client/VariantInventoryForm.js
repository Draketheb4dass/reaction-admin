import React, { Fragment, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Components } from "@reactioncommerce/reaction-components";
import Button from "@reactioncommerce/catalyst/Button";
import i18next from "i18next";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardHeader from "@material-ui/core/CardHeader";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Grid from "@material-ui/core/Grid";
import useReactoForm from "reacto-form/cjs/useReactoForm";
import SimpleSchema from "simpl-schema";
import muiOptions from "reacto-form/cjs/muiOptions";
import TextField from "@reactioncommerce/catalyst/TextField";
import { Box, Checkbox } from "@material-ui/core";
import useVariantInventory from "./useVariantInventory";

const formSchema = new SimpleSchema({
  inventoryInStock: {
    type: Number,
    optional: true
  },
  lowInventoryWarningThreshold: {
    type: Number,
    optional: true
  },
  canBackorder: Boolean,
  isEnabled: Boolean
});

const validator = formSchema.getFormValidator();

/**
 * Variant inventory form block component
 * @param {Object} props Component props
 * @returns {Node} React node
 */
function VariantInventoryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnabled, setIsEnabled] = useState();
  const [canBackorder, setCanBackorder] = useState();
  const {
    currentVariant,
    hasChildVariants,
    inventoryInfo,
    isLoading: isLoadingInventoryInfo,
    onRecalculateReservedSimpleInventory,
    onUpdateVariantInventoryInfo
  } = useVariantInventory();

  const {
    formData: currentFormData,
    getFirstErrorMessage,
    getInputProps,
    hasErrors,
    isDirty,
    submitForm
  } = useReactoForm({
    async onSubmit(formData) {
      setIsSubmitting(true);

      await onUpdateVariantInventoryInfo({
        inventoryInput: formSchema.clean({
          ...formData,
          isEnabled,
          canBackorder
        })
      });

      setIsSubmitting(false);
    },
    validator(formData) {
      return validator(formSchema.clean({
        ...formData,
        isEnabled,
        canBackorder
      }));
    },
    value: inventoryInfo
  });

  useEffect(() => {
    if (inventoryInfo) {
      setIsEnabled(inventoryInfo.isEnabled || false);
      setCanBackorder(inventoryInfo.canBackorder || true);
    }
  }, [
    inventoryInfo
  ]);

  if (!currentVariant) return null;

  if (isLoadingInventoryInfo) return <Components.Loading />;

  const {
    inventoryInStock,
    inventoryReserved
  } = currentFormData;

  let content;
  if (hasChildVariants) {
    content = (
      <Fragment>
        <p>{i18next.t("productVariant.noInventoryTracking")}</p>
      </Fragment>
    );
  } else {
    const inventoryInStockHelperText = isEnabled ? i18next.t("productVariant.inventoryInStockHelpText", {
      inventoryAvailableToSell: Math.max((inventoryInStock || 0) - (inventoryReserved || 0), 0),
      inventoryInStock: (inventoryInStock || 0),
      inventoryReserved: (inventoryReserved || 0)
    }) : i18next.t("productVariant.inventoryDisabled");

    const inventoryInStockInputProps = getInputProps("inventoryInStock", muiOptions);
    const lowInventoryWarningThresholdInputProps = getInputProps("lowInventoryWarningThreshold", muiOptions);

    content = (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitForm();
        }}
      >
        <p>{i18next.t("productVariant.inventoryMessage")}</p>
        <FormControlLabel
          checked={isEnabled}
          onChange={(event) => {
            setIsEnabled(event.target.checked);
          }}
          control={<Checkbox />}
          label={i18next.t("productVariant.isInventoryManagementEnabled")}
        />
        <Grid container spacing={1}>
          <Grid item sm={6}>
            <TextField
              disabled={!isEnabled}
              error={hasErrors(["inventoryInStock"])}
              fullWidth
              helperText={getFirstErrorMessage(["inventoryInStock"]) || inventoryInStockHelperText}
              label={i18next.t("productVariant.inventoryInStock")}
              placeholder="0"
              type="number"
              {...inventoryInStockInputProps}
              value={isEnabled ? inventoryInStockInputProps.value : 0}
            />
            <Button
              disabled={!isEnabled}
              variant="text"
              onClick={() => {
                onRecalculateReservedSimpleInventory();
              }}
              title="Recalculate"
            >{i18next.t("productVariant.recalculateReservedInventory")}</Button>
          </Grid>
          <Grid item sm={6}>
            <TextField
              disabled={!isEnabled}
              error={hasErrors(["lowInventoryWarningThreshold"])}
              fullWidth
              helperText={getFirstErrorMessage(["lowInventoryWarningThreshold"]) || i18next.t("productVariant.lowInventoryWarningThresholdLabel")}
              label={i18next.t("productVariant.lowInventoryWarningThreshold")}
              placeholder="0"
              type="number"
              {...lowInventoryWarningThresholdInputProps}
              value={isEnabled ? lowInventoryWarningThresholdInputProps.value : 0}
            />
          </Grid>
        </Grid>
        <Grid container spacing={1}>
          <Grid item sm={12}>
            <FormControlLabel
              checked={isEnabled ? canBackorder : true}
              disabled={!isEnabled}
              onChange={(event) => {
                setCanBackorder(event.target.checked);
              }}
              control={<Checkbox />}
              label={i18next.t("productVariant.allowBackorder")}
            />
          </Grid>
        </Grid>
        <Box textAlign="right">
          <Button
            color="primary"
            disabled={!isDirty || isSubmitting}
            variant="contained"
            type="submit"
          >
            {i18next.t("app.save")}
          </Button>
        </Box>
      </form>
    );
  }

  return (
    <Card>
      <CardHeader title={i18next.t("productVariant.inventoryHeading")} />
      <CardContent>{content}</CardContent>
    </Card>
  );
}

VariantInventoryForm.propTypes = {
  components: PropTypes.shape({
    Button: PropTypes.any
  })
};

export default VariantInventoryForm;
